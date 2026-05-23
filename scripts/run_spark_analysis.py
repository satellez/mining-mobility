"""
Análisis extendido de siniestros viales con PySpark:
  - Spark SQL aggregations sobre 196K registros
  - Random Forest con importancia de características y matriz de confusión
  - K-Means clustering sobre el dataset completo (no muestra)

Salidas: data/spark_stats.json, data/spark_ml.json
"""

import json
import os
import time

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType
from pyspark.ml import Pipeline
from pyspark.ml.classification import RandomForestClassifier
from pyspark.ml.clustering import KMeans
from pyspark.ml.evaluation import ClusteringEvaluator, MulticlassClassificationEvaluator
from pyspark.ml.feature import StandardScaler, StringIndexer, VectorAssembler

BASE    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_IN = os.path.join(BASE, "data", "siniestros_detalle_completo.json")
OUT_DIR = os.path.join(BASE, "data")

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

# ── 1. Carga ───────────────────────────────────────────────────────────────
print("[1/6] Cargando JSON...")
t0 = time.time()
raw = spark.read.option("multiLine", "true").option("encoding", "UTF-8").json(JSON_IN)
t_carga = round(time.time() - t0, 2)
print(f"   Schema inferido en {t_carga}s")

# ── 2. Aplanar estructura anidada ──────────────────────────────────────────
print("[2/6] Aplanando estructura...")
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
print(f"   {total:,} registros validos")

# ── 3. Spark SQL aggregations ──────────────────────────────────────────────
print("[3/6] Ejecutando agregaciones SQL...")
df.createOrReplaceTempView("siniestros")

def to_list(sdf):
    return [row.asDict() for row in sdf.collect()]

por_gravedad_raw = to_list(spark.sql("""
    SELECT gravedad, COUNT(*) AS total
    FROM siniestros GROUP BY gravedad ORDER BY total DESC
"""))
for r in por_gravedad_raw:
    r["pct"] = round(r["total"] * 100 / total, 1)

top_localidades = to_list(spark.sql("""
    SELECT localidad, COUNT(*) AS total,
           SUM(CASE WHEN gravedad='Con Muertos' THEN 1 ELSE 0 END) AS con_muertos
    FROM siniestros GROUP BY localidad ORDER BY total DESC LIMIT 10
"""))

por_hora = to_list(spark.sql("""
    SELECT hora, COUNT(*) AS total
    FROM siniestros WHERE hora >= 0 GROUP BY hora ORDER BY hora
"""))

por_clase = to_list(spark.sql("""
    SELECT clase, COUNT(*) AS total
    FROM siniestros GROUP BY clase ORDER BY total DESC LIMIT 8
"""))

hipotesis_top = to_list(spark.sql("""
    SELECT hipotesis, COUNT(*) AS total
    FROM siniestros GROUP BY hipotesis ORDER BY total DESC LIMIT 8
"""))

vehiculo_top = to_list(spark.sql("""
    SELECT tipo_vehiculo, COUNT(*) AS total
    FROM siniestros GROUP BY tipo_vehiculo ORDER BY total DESC LIMIT 8
"""))

tendencia_anual = to_list(spark.sql("""
    SELECT anio, COUNT(*) AS total,
           SUM(CASE WHEN gravedad='Con Muertos' THEN 1 ELSE 0 END) AS con_muertos,
           SUM(CASE WHEN gravedad='Con Heridos' THEN 1 ELSE 0 END) AS con_heridos,
           SUM(CASE WHEN gravedad='Solo Daños'  THEN 1 ELSE 0 END) AS solo_danos
    FROM siniestros GROUP BY anio ORDER BY anio
"""))

# ── 4. Random Forest: importancia de caracteristicas + confusion matrix ────
print("[4/6] Entrenando Random Forest (sin OHE)...")
t_rf = time.time()

cat_cols = ["clase", "hipotesis", "tipo_vehiculo"]
num_cols = ["hora", "localidad", "num_vehiculos", "num_actores"]
feature_names = cat_cols + num_cols

# Sin OneHotEncoder: StringIndexer + VectorAssembler
# Los arboles de decision manejan indices ordinales de forma nativa
indexers_si = [
    StringIndexer(inputCol=c, outputCol=c + "_idx", handleInvalid="keep")
    for c in cat_cols
]
label_ix = StringIndexer(inputCol="gravedad", outputCol="label", handleInvalid="keep")
assembler_si = VectorAssembler(
    inputCols=[c + "_idx" for c in cat_cols] + num_cols,
    outputCol="features",
    handleInvalid="keep",
)
rf = RandomForestClassifier(
    featuresCol="features", labelCol="label",
    numTrees=50, maxDepth=6, seed=42,
    maxBins=256,
)
pipeline_rf = Pipeline(stages=indexers_si + [label_ix, assembler_si, rf])

train_df, test_df = df.randomSplit([0.8, 0.2], seed=42)
model_rf = pipeline_rf.fit(train_df)
preds_rf  = model_rf.transform(test_df)
t_rf_total = round(time.time() - t_rf, 1)

ev = MulticlassClassificationEvaluator(labelCol="label", predictionCol="prediction")
accuracy = round(ev.setMetricName("accuracy").evaluate(preds_rf), 4)
f1       = round(ev.setMetricName("f1").evaluate(preds_rf), 4)
w_prec   = round(ev.setMetricName("weightedPrecision").evaluate(preds_rf), 4)
w_recall = round(ev.setMetricName("weightedRecall").evaluate(preds_rf), 4)
print(f"   RF: accuracy={accuracy} | F1={f1} | tiempo={t_rf_total}s")

# Importancia de caracteristicas (alineada con feature_names)
rf_stage = model_rf.stages[-1]
importances = rf_stage.featureImportances.toArray().tolist()
feature_importance = sorted(
    [{"feature": n, "importance": round(v, 4)} for n, v in zip(feature_names, importances)],
    key=lambda x: -x["importance"],
)

# Etiquetas reales desde el StringIndexer de gravedad (orden = frecuencia)
label_stage = model_rf.stages[len(indexers_si)]  # posicion de label_ix
labels = list(label_stage.labels)
num_labels = len(labels)

# Matriz de confusion
conf_rows = (
    preds_rf
    .select(
        F.col("label").cast("int").alias("actual"),
        F.col("prediction").cast("int").alias("predicted"),
    )
    .groupBy("actual", "predicted")
    .count()
    .collect()
)
conf_matrix = [[0] * num_labels for _ in range(num_labels)]
for row in conf_rows:
    i, j = row["actual"], row["predicted"]
    if 0 <= i < num_labels and 0 <= j < num_labels:
        conf_matrix[i][j] = int(row["count"])

# ── 5. K-Means clustering — dataset completo ──────────────────────────────
print("[5/6] K-Means clustering sobre dataset completo (k=5)...")
t_km = time.time()

km_features = ["hora", "localidad", "num_vehiculos", "num_actores"]
km_cat_cols = ["clase", "tipo_vehiculo"]

km_indexers = [
    StringIndexer(inputCol=c, outputCol=c + "_km_idx", handleInvalid="keep")
    for c in km_cat_cols
]
assembler_km = VectorAssembler(
    inputCols=km_features + [c + "_km_idx" for c in km_cat_cols],
    outputCol="features_raw",
    handleInvalid="keep",
)
scaler_km = StandardScaler(
    inputCol="features_raw", outputCol="features_km",
    withMean=True, withStd=True,
)
kmeans = KMeans(
    featuresCol="features_km", predictionCol="cluster",
    k=5, maxIter=20, seed=42,
)
km_pipeline = Pipeline(stages=km_indexers + [assembler_km, scaler_km, kmeans])
km_model    = km_pipeline.fit(df)
df_clustered = km_model.transform(df)

sil_ev    = ClusteringEvaluator(featuresCol="features_km", predictionCol="cluster",
                                metricName="silhouette")
silhouette = round(sil_ev.evaluate(df_clustered), 4)
t_km_total = round(time.time() - t_km, 1)
print(f"   KMeans: silhouette={silhouette} | tiempo={t_km_total}s")

cluster_agg = to_list(
    df_clustered.groupBy("cluster").agg(
        F.count("*").alias("size"),
        F.round(F.avg(F.when(F.col("hora") >= 0, F.col("hora"))), 1).alias("hora_media"),
        F.round(F.avg("num_actores"), 2).alias("num_actores_media"),
        F.round(F.avg("num_vehiculos"), 2).alias("num_vehiculos_media"),
        F.sum(F.when(F.col("gravedad") == "Con Muertos", 1).otherwise(0)).alias("con_muertos"),
        F.sum(F.when(F.col("gravedad") == "Con Heridos", 1).otherwise(0)).alias("con_heridos"),
        F.sum(F.when(F.col("gravedad") == "Solo Danios", 1).otherwise(0)).alias("solo_danos"),
    ).orderBy("cluster")
)

clusters = []
for cs in cluster_agg:
    sz = cs["size"]
    muertos  = int(cs["con_muertos"])
    heridos  = int(cs["con_heridos"])
    solo_d   = sz - muertos - heridos
    clusters.append({
        "cluster_id":         cs["cluster"],
        "size":               sz,
        "pct":                round(sz * 100 / total, 1),
        "hora_media":         float(cs["hora_media"] or 0),
        "num_actores_media":  float(cs["num_actores_media"] or 0),
        "num_vehiculos_media":float(cs["num_vehiculos_media"] or 0),
        "gravedad": {
            "Con Muertos": muertos,
            "Con Heridos": heridos,
            "Solo Danios": solo_d,
        },
    })

# ── 6. Guardar ─────────────────────────────────────────────────────────────
print("[6/6] Guardando resultados...")
t_total = round(time.time() - t_global, 1)

stats = {
    "total_registros":  total,
    "tiempo_carga_s":   t_carga,
    "tiempo_total_s":   t_total,
    "por_gravedad":     por_gravedad_raw,
    "top_localidades":  top_localidades,
    "por_hora":         por_hora,
    "por_clase":        por_clase,
    "hipotesis_top":    hipotesis_top,
    "vehiculo_top":     vehiculo_top,
    "tendencia_anual":  tendencia_anual,
}

ml_results = {
    "algoritmo":              "Random Forest (MLlib)",
    "num_arboles":            50,
    "max_depth":              6,
    "train_size":             train_df.count(),
    "test_size":              test_df.count(),
    "accuracy":               accuracy,
    "f1":                     f1,
    "weighted_precision":     w_prec,
    "weighted_recall":        w_recall,
    "tiempo_entrenamiento_s": t_rf_total,
    "labels":                 labels,
    "feature_importance":     feature_importance,
    "confusion_matrix": {
        "labels": labels,
        "matrix": conf_matrix,
    },
    "kmeans": {
        "k":              5,
        "silhouette":     silhouette,
        "tiempo_s":       t_km_total,
        "features_usadas":["hora", "localidad", "num_vehiculos", "num_actores", "clase", "tipo_vehiculo"],
        "clusters":       clusters,
    },
}

with open(os.path.join(OUT_DIR, "spark_stats.json"), "w", encoding="utf-8") as f:
    json.dump(stats, f, ensure_ascii=False, indent=2, default=int)

with open(os.path.join(OUT_DIR, "spark_ml.json"), "w", encoding="utf-8") as f:
    json.dump(ml_results, f, ensure_ascii=False, indent=2, default=float)

spark.stop()
print(f"\n[OK] Completado en {t_total}s — resultados en data/spark_stats.json y data/spark_ml.json")
