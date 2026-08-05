-- ============================================================================
-- route_benchmarks — tabela agregada que alimenta a LP do Compass
-- ============================================================================
--
-- Rode como SCHEDULED QUERY no BigQuery (sugestão: diária, 04:00 BRT) com
-- destino em `analytics_marketing.route_benchmarks`, write disposition
-- WRITE_TRUNCATE.
--
-- POR QUE AGREGAR EM VEZ DE CONSULTAR AO VIVO
-- A LP é pública. Query por visitante significa custo por byte lido
-- multiplicado pelo tráfego de campanha, mais alguns segundos de latência no
-- momento mais sensível do funil. Agregando uma vez por dia, a API só lê uma
-- tabela de dezenas de linhas: custo previsível e resposta em milissegundos.
--
-- ADAPTAR ANTES DE USAR
-- Os nomes de tabela e coluna abaixo são placeholders. Troque pelos nomes
-- reais do seu warehouse. O que precisa sair no fim é exatamente o schema
-- consumido por lib/benchmarks/bigquery.ts.
-- ============================================================================

WITH bookings AS (
  SELECT
    origin_iata,
    destination_iata,
    -- Tarifa paga, em centavos, para não arredondar dinheiro em float
    CAST(ROUND(total_fare_brl * 100) AS INT64) AS fare_cents,
    -- Canal da reserva: distingue quem reservou via Onfly de quem não
    booking_channel,
    -- Minutos entre abrir a busca e confirmar a reserva
    booking_duration_minutes,
    booked_at
  FROM `SEU_PROJETO.core.bookings`          -- <<< AJUSTAR
  WHERE
    booked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY)
    AND trip_type = 'DOMESTIC_FLIGHT'
    AND total_fare_brl > 0
    -- Remove outliers grosseiros que distorcem a mediana em rotas pequenas
    AND total_fare_brl BETWEEN 150 AND 8000
),

-- Mediana é mais honesta que média aqui: uma passagem de última hora a
-- R$ 6.000 não deve puxar o número que o prospect vê na tela.
aggregated AS (
  SELECT
    origin_iata,
    destination_iata,

    APPROX_QUANTILES(
      IF(booking_channel != 'ONFLY', fare_cents, NULL), 100
    )[OFFSET(50)] AS market_fare_cents,

    APPROX_QUANTILES(
      IF(booking_channel = 'ONFLY', fare_cents, NULL), 100
    )[OFFSET(50)] AS onfly_fare_cents,

    APPROX_QUANTILES(
      IF(booking_channel != 'ONFLY', booking_duration_minutes, NULL), 100
    )[OFFSET(50)] AS booking_minutes_today,

    APPROX_QUANTILES(
      IF(booking_channel = 'ONFLY', booking_duration_minutes, NULL), 100
    )[OFFSET(50)] AS booking_minutes_onfly,

    COUNT(*) AS sample_size,
    COUNTIF(booking_channel = 'ONFLY') AS onfly_sample_size

  FROM bookings
  GROUP BY origin_iata, destination_iata
)

SELECT
  CONCAT(a.origin_iata, '-', a.destination_iata) AS route_code,
  CONCAT(o.city_name, ' › ', d.city_name)        AS route_label,
  a.origin_iata,
  a.destination_iata,
  a.market_fare_cents,
  a.onfly_fare_cents,
  a.booking_minutes_today,
  a.booking_minutes_onfly,
  a.sample_size,
  CURRENT_DATE('America/Sao_Paulo') AS refreshed_at

FROM aggregated a
JOIN `SEU_PROJETO.core.airports` o ON o.iata_code = a.origin_iata        -- <<< AJUSTAR
JOIN `SEU_PROJETO.core.airports` d ON d.iata_code = a.destination_iata   -- <<< AJUSTAR

WHERE
  -- Amostra mínima em CADA canal: sem isso a comparação não se sustenta.
  -- Precisa casar com MIN_SAMPLE_SIZE em lib/benchmarks/bigquery.ts.
  a.sample_size >= 200
  AND a.onfly_sample_size >= 50
  AND a.market_fare_cents IS NOT NULL
  AND a.onfly_fare_cents IS NOT NULL
  -- Só publicamos rotas onde a Onfly realmente sai na frente. Uma rota em que
  -- perdemos não deve virar material de venda.
  AND a.onfly_fare_cents < a.market_fare_cents

ORDER BY a.sample_size DESC
LIMIT 50;
