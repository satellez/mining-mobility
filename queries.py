MODELADO_QUERIES = {
    '_conteos': """
        SELECT 'fact_siniestros' AS tabla, COUNT(*) AS filas FROM fact_siniestros
        UNION ALL SELECT 'dim_fecha',      COUNT(*) FROM dim_fecha
        UNION ALL SELECT 'dim_localidad',  COUNT(*) FROM dim_localidad
        UNION ALL SELECT 'dim_actor',      COUNT(*) FROM dim_actor
    """,
    'gravedad': """
        SELECT gravedad AS descripcion, COUNT(*) AS total
        FROM fact_siniestros
        GROUP BY gravedad, gravedad_nivel ORDER BY gravedad_nivel
    """,
    'tendencia': """
        SELECT f.anio, f.mes, COUNT(*) AS total
        FROM fact_siniestros s
        JOIN dim_fecha f ON s.fecha_id = f.fecha_id
        GROUP BY f.anio, f.mes ORDER BY f.anio, f.mes
    """,
    'por_hora': """
        SELECT hora, COUNT(*) AS total
        FROM fact_siniestros WHERE hora IS NOT NULL
        GROUP BY hora ORDER BY hora
    """,
    'hipotesis': """
        SELECT hip AS descripcion, COUNT(*) AS total
        FROM fact_siniestros, UNNEST(hipotesis) AS hip
        GROUP BY hip ORDER BY total DESC LIMIT 10
    """,
    'evolucion_gravedad': """
        SELECT f.anio, s.gravedad AS descripcion, COUNT(*) AS total
        FROM fact_siniestros s
        JOIN dim_fecha f ON s.fecha_id = f.fecha_id
        GROUP BY f.anio, s.gravedad, s.gravedad_nivel ORDER BY f.anio, s.gravedad_nivel
    """,
    'actores_estado': """
        SELECT condicion, estado, COUNT(*) AS total
        FROM dim_actor
        GROUP BY condicion, estado ORDER BY condicion, estado
    """,
    'hora_fatal': """
        SELECT hora,
               SUM(CASE WHEN gravedad_nivel = 1 THEN 1 ELSE 0 END) AS muertos,
               COUNT(*) AS total
        FROM fact_siniestros
        WHERE hora IS NOT NULL
        GROUP BY hora ORDER BY hora
    """,
    'causas_fatales': """
        SELECT hip AS descripcion, COUNT(*) AS total
        FROM fact_siniestros, UNNEST(hipotesis) AS hip
        WHERE gravedad_nivel = 1
        GROUP BY hip ORDER BY total DESC LIMIT 10
    """,
    'clase_gravedad': """
        SELECT clase, gravedad, COUNT(*) AS total
        FROM fact_siniestros
        GROUP BY clase, gravedad, gravedad_nivel
        ORDER BY gravedad_nivel, total DESC
    """,
    'tabla_localidades': """
        SELECT l.nombre,
               l.zona,
               COUNT(*) AS total,
               SUM(CASE WHEN s.gravedad_nivel = 1 THEN 1 ELSE 0 END) AS con_muertos,
               SUM(CASE WHEN s.gravedad_nivel = 2 THEN 1 ELSE 0 END) AS con_heridos,
               SUM(CASE WHEN s.gravedad_nivel = 3 THEN 1 ELSE 0 END) AS solo_danos,
               ROUND(SUM(CASE WHEN s.gravedad_nivel = 1 THEN 1 ELSE 0 END) * 1000.0 / COUNT(*), 1) AS tasa_mortalidad
        FROM fact_siniestros s
        JOIN dim_localidad l ON s.localidad_id = l.localidad_id
        GROUP BY l.nombre, l.zona ORDER BY con_muertos DESC
    """,
}
