MODELADO_QUERIES = {
    '_conteos': """
        SELECT 'fact_siniestros' AS tabla, COUNT(*) AS filas FROM fact_siniestros
        UNION ALL SELECT 'dim_fecha',       COUNT(*) FROM dim_fecha
        UNION ALL SELECT 'dim_localidad',   COUNT(*) FROM dim_localidad
        UNION ALL SELECT 'dim_gravedad',    COUNT(*) FROM dim_gravedad
        UNION ALL SELECT 'dim_clase',       COUNT(*) FROM dim_clase
        UNION ALL SELECT 'dim_hipotesis',   COUNT(*) FROM dim_hipotesis
        UNION ALL SELECT 'dim_vehiculo',    COUNT(*) FROM dim_vehiculo
        UNION ALL SELECT 'dim_actor',       COUNT(*) FROM dim_actor
    """,
    'gravedad': """
        SELECT g.descripcion, COUNT(*) AS total
        FROM fact_siniestros s
        JOIN dim_gravedad g ON s.gravedad_id = g.gravedad_id
        GROUP BY g.descripcion, g.nivel ORDER BY g.nivel
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
        SELECT descripcion, COUNT(*) AS total
        FROM dim_hipotesis
        GROUP BY descripcion ORDER BY total DESC LIMIT 10
    """,
    'evolucion_gravedad': """
        SELECT f.anio, g.descripcion, COUNT(*) AS total
        FROM fact_siniestros s
        JOIN dim_fecha   f ON s.fecha_id   = f.fecha_id
        JOIN dim_gravedad g ON s.gravedad_id = g.gravedad_id
        GROUP BY f.anio, g.descripcion, g.nivel ORDER BY f.anio, g.nivel
    """,
    'actores_estado': """
        SELECT condicion, estado, COUNT(*) AS total
        FROM dim_actor
        GROUP BY condicion, estado ORDER BY condicion, estado
    """,
    'hora_fatal': """
        SELECT s.hora,
               SUM(CASE WHEN g.nivel = 1 THEN 1 ELSE 0 END) AS muertos,
               COUNT(*) AS total
        FROM fact_siniestros s
        JOIN dim_gravedad g ON s.gravedad_id = g.gravedad_id
        WHERE s.hora IS NOT NULL
        GROUP BY s.hora ORDER BY s.hora
    """,
    'causas_fatales': """
        SELECT h.descripcion, COUNT(*) AS total
        FROM dim_hipotesis h
        JOIN fact_siniestros s ON h.siniestro_id = s.siniestro_id
        JOIN dim_gravedad g    ON s.gravedad_id  = g.gravedad_id
        WHERE g.nivel = 1
        GROUP BY h.descripcion ORDER BY total DESC LIMIT 10
    """,
    'tabla_localidades': """
        SELECT l.nombre,
               COUNT(*) AS total,
               SUM(CASE WHEN g.nivel = 1 THEN 1 ELSE 0 END) AS con_muertos,
               SUM(CASE WHEN g.nivel = 2 THEN 1 ELSE 0 END) AS con_heridos,
               SUM(CASE WHEN g.nivel = 3 THEN 1 ELSE 0 END) AS solo_danos,
               ROUND(SUM(CASE WHEN g.nivel = 1 THEN 1 ELSE 0 END) * 1000.0 / COUNT(*), 1) AS tasa_mortalidad
        FROM fact_siniestros s
        JOIN dim_localidad l ON s.localidad_id = l.localidad_id
        JOIN dim_gravedad  g ON s.gravedad_id  = g.gravedad_id
        GROUP BY l.nombre ORDER BY con_muertos DESC
    """,
}
