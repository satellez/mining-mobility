"""
Análisis de siniestros viales con PySpark.
Guarda resultados en data/spark_stats.json y data/spark_ml.json.

Requisitos:
    pip install pyspark
    Java 11+ en PATH

Uso:
    python scripts/run_spark_analysis.py
"""

import json
import os
import time

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType
from pyspark.ml import Pipeline
from pyspark.ml.classification import RandomForestClassifier
from pyspark.ml.evaluation import MulticlassClassificationEvaluator
from pyspark.ml.feature import OneHotEncoder, StringIndexer, VectorAssembler

BASE     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_IN  = os.path.join(BASE, "data", "siniestros_detalle_completo.json")
OUT_DIR  = os.path.join(BASE, "data")

# ── SparkSession ───────────────────────────────────────────────────────────
spark = (
    SparkSession.builder
    .appName("SiniestrosBogota")
    .config("spark.driver.memory", "3g")
    .config("spark.sql.shuffle.partitions", "8")
    .config("spark.sql.execution.arrow.pyspark.enabled", "false")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")

t_global = time.time()

# ── 1. Carga del JSON ──────────────────────────────────────────────────────
print("[1/5] Cargando JSON...")
t0 = time.time()
raw = spark.read.option("multiLine", "true").option("encoding", "UTF-8").json(JSON_IN)
t_carga = round(time.time() - t0, 2)
print(f"   Schema inferido en {t_carga}s")

# ── 2. Aplanar estructura anidada ──────────────────────────────────────────
print("[2/5] Aplanando estructura...")
df = (
    raw.select(
        F.col("CODIGO_ACCIDENTE"),
        F.to_date("FECHA_STR", "yyyy-MM-dd").alias("fecha"),
        F.year(F.to_date("FECHA_STR", "yyyy-MM-dd")).alias("anio"),
        F.month(F.to_date("FECHA_STR", "yyyy-MM-dd")).alias("mes"),
        F.get(F.split("HORA", ":"), 0).cast(IntegerType()).alias("hora"),
        F.col("GRAVEDAD").alias("gravedad"),
        F.col("CLASE").alias("clase"),
        F.col("CODIGO_LOCALIDAD").cast(IntegerType()).alias("localidad"),
        F.get(F.col("HIPOTESIS_LISTA"), 0).alias("hipotesis"),
        F.get(F.col("VEHICULOS_INVOLUCRADOS"), 0)["CLASE"].alias("tipo_vehiculo"),
        F.size("HIPOTESIS_LISTA").alias("num_hipotesis"),
        F.size("VEHICULOS_INVOLUCRADOS").alias("num_vehiculos"),
        F.size("ACTORES_INVOLUCRADOS").alias("num_actores"),
    )
    .filter(F.col("gravedad").isin("Con Heridos", "Con Muertos", "Solo Daños"))
    .na.fill({"hipotesis": "Desconocida", "tipo_vehiculo": "Otro", "hora": -1})
)

df.cache()
total = df.count()
print(f"   {total:,} registros válidos")

# ── 3. Vistas SQL ──────────────────────────────────────────────────────────
df.createOrReplaceTempView("siniestros")

# ── 4. Agregaciones ────────────────────────────────────────────────────────
print("[3/5] Ejecutando agregaciones...")

def to_list(sdf):
    return [row.asDict() for row in sdf.collect()]

por_gravedad_raw = to_list(
    spark.sql("""
        SELECT gravedad, COUNT(*) AS total
        FROM siniestros GROUP BY gravedad ORDER BY total DESC
    """)
)
for r in por_gravedad_raw:
    r["pct"] = round(r["total"] * 100 / total, 1)

top_localidades = to_list(
    spark.sql("""
        SELECT localidad,
               COUNT(*) AS total,
               SUM(CASE WHEN gravedad='Con Muertos' THEN 1 ELSE 0 END) AS con_muertos
        FROM siniestros
        GROUP BY localidad ORDER BY total DESC LIMIT 10
    """)
)

por_hora = to_list(
    spark.sql("""
        SELECT hora, COUNT(*) AS total
        FROM siniestros WHERE hora >= 0
        GROUP BY hora ORDER BY hora
    """)
)

por_clase = to_list(
    spark.sql("""
        SELECT clase, COUNT(*) AS total
        FROM siniestros GROUP BY clase ORDER BY total DESC LIMIT 8
    """)
)

hipotesis_top = to_list(
    spark.sql("""
        SELECT hipotesis, COUNT(*) AS total
        FROM siniestros GROUP BY hipotesis ORDER BY total DESC LIMIT 8
    """)
)

vehiculo_top = to_list(
    spark.sql("""
        SELECT tipo_vehiculo, COUNT(*) AS total
        FROM siniestros GROUP BY tipo_vehiculo ORDER BY total DESC LIMIT 8
    """)
)

tendencia_anual = to_list(
    spark.sql("""
        SELECT anio, COUNT(*) AS total,
               SUM(CASE WHEN gravedad='Con Muertos' THEN 1 ELSE 0 END) AS con_muertos,
               SUM(CASE WHEN gravedad='Con Heridos' THEN 1 ELSE 0 END) AS con_heridos,
               SUM(CASE WHEN gravedad='Solo Daños'  THEN 1 ELSE 0 END) AS solo_danos
        FROM siniestros
        GROUP BY anio ORDER BY anio
    """)
)

# ── 5. Pipeline MLlib — Random Forest ─────────────────────────────────────
print("[4/5] Entrenando Random Forest con MLlib...")
t_ml = time.time()

cat_cols = ["clase", "hipotesis", "tipo_vehiculo"]
num_cols = ["hora", "localidad", "num_vehiculos", "num_actores"]

indexers = [
    StringIndexer(inputCol=c, outputCol=c + "_idx", handleInvalid="keep")
    for c in cat_cols
]
label_ix = StringIndexer(inputCol="gravedad", outputCol="label", handleInvalid="keep")
encoders = [
    OneHotEncoder(inputCol=c + "_idx", outputCol=c + "_ohe", handleInvalid="keep")
    for c in cat_cols
]
assembler = VectorAssembler(
    inputCols=[c + "_ohe" for c in cat_cols] + num_cols,
    outputCol="features",
    handleInvalid="keep",
)
rf = RandomForestClassifier(
    featuresCol="features", labelCol="label",
    numTrees=100, maxDepth=8, seed=42,
)

pipeline = Pipeline(stages=indexers + [label_ix] + encoders + [assembler, rf])

train_df, test_df = df.randomSplit([0.8, 0.2], seed=42)
model = pipeline.fit(train_df)
preds = model.transform(test_df)
t_ml_total = round(time.time() - t_ml, 1)

ev = MulticlassClassificationEvaluator(labelCol="label", predictionCol="prediction")
accuracy  = round(ev.setMetricName("accuracy").evaluate(preds), 4)
f1        = round(ev.setMetricName("f1").evaluate(preds), 4)
w_prec    = round(ev.setMetricName("weightedPrecision").evaluate(preds), 4)
w_recall  = round(ev.setMetricName("weightedRecall").evaluate(preds), 4)

print(f"   RF entrenado en {t_ml_total}s | accuracy={accuracy} | F1={f1}")

# ── 6. Guardar ─────────────────────────────────────────────────────────────
t_total = round(time.time() - t_global, 1)

stats = {
    "total_registros": total,
    "tiempo_carga_s": t_carga,
    "tiempo_total_s": t_total,
    "por_gravedad": por_gravedad_raw,
    "top_localidades": top_localidades,
    "por_hora": por_hora,
    "por_clase": por_clase,
    "hipotesis_top": hipotesis_top,
    "vehiculo_top": vehiculo_top,
    "tendencia_anual": tendencia_anual,
}

ml_results = {
    "algoritmo": "Random Forest (MLlib)",
    "num_arboles": 100,
    "max_depth": 8,
    "train_size": train_df.count(),
    "test_size": test_df.count(),
    "accuracy": accuracy,
    "f1": f1,
    "weighted_precision": w_prec,
    "weighted_recall": w_recall,
    "tiempo_entrenamiento_s": t_ml_total,
}

with open(os.path.join(OUT_DIR, "spark_stats.json"), "w", encoding="utf-8") as f:
    json.dump(stats, f, ensure_ascii=False, indent=2, default=int)

with open(os.path.join(OUT_DIR, "spark_ml.json"), "w", encoding="utf-8") as f:
    json.dump(ml_results, f, ensure_ascii=False, indent=2)

spark.stop()
print(f"\n[OK] Completado en {t_total}s — resultados en data/spark_stats.json y data/spark_ml.json")
