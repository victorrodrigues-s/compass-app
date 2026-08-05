'use client';

import { useEffect, useRef, useState } from 'react';
import type { Airport } from '@/lib/types';

/**
 * Campo de busca de aeroporto com autocomplete.
 *
 * CUSTO: cada busca pode virar uma requisição paga na API de tarifas. Por isso
 * o componente NÃO chama a cada tecla — espera 350ms de silêncio e exige 3+
 * caracteres. Sem isso, digitar "São Paulo" dispararia nove requisições.
 *
 * O valor só é considerado válido quando o usuário SELECIONA uma opção da
 * lista: texto digitado à mão não vira código IATA.
 */

export interface AirportSelectProps {
  id: string;
  label: string;
  placeholder: string;
  selected: Airport | null;
  onSelect: (airport: Airport | null) => void;
}

const DEBOUNCE_MS = 350;
const MIN_CHARS = 3;

export default function AirportSelect({
  id,
  label,
  placeholder,
  selected,
  onSelect,
}: AirportSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Busca com debounce. O cleanup cancela o timer E ignora respostas antigas,
  // então uma resposta lenta nunca sobrescreve uma busca mais recente.
  useEffect(() => {
    if (selected) return; // já escolheu, não busca mais
    const q = query.trim();

    if (q.length < MIN_CHARS) {
      setResults([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setFailed(false);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/airports?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({ airports: [] }));
        if (!active) return;
        setResults(data.airports ?? []);
        setFailed(!res.ok);
        setOpen(true);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, selected]);

  function choose(airport: Airport) {
    onSelect(airport);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function clear() {
    onSelect(null);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="oc-field" ref={boxRef}>
      <label className="oc-label" htmlFor={id}>
        {label}
      </label>

      {selected ? (
        // Estado escolhido: mostra a seleção com um botão para trocar.
        <div className="oc-airport-picked">
          <span>
            <strong>{selected.code}</strong>
            {selected.city ? ` — ${selected.city}` : ''}
            {selected.name ? <span className="oc-airport-sub"> · {selected.name}</span> : null}
          </span>
          <button type="button" className="oc-airport-clear" onClick={clear}>
            trocar
          </button>
        </div>
      ) : (
        <div className="oc-airport-wrap">
          <input
            id={id}
            className="oc-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
          />

          {open && (
            <ul className="oc-airport-list" id={`${id}-list`} role="listbox">
              {results.length > 0 ? (
                results.map((a) => (
                  <li key={a.code}>
                    <button type="button" className="oc-airport-option" onClick={() => choose(a)}>
                      <span className="oc-airport-code">{a.code}</span>
                      <span>
                        <span className="oc-airport-city">{a.city}</span>
                        <span className="oc-airport-sub">
                          {a.name}
                          {a.country ? ` · ${a.country}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="oc-airport-empty">
                  {failed
                    ? 'Não conseguimos buscar agora. Tente de novo.'
                    : 'Nenhum aeroporto encontrado.'}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <span className="oc-muted">
        {selected
          ? '\u00A0'
          : loading
            ? 'Buscando…'
            : query.trim().length > 0 && query.trim().length < MIN_CHARS
              ? `Digite ao menos ${MIN_CHARS} letras`
              : 'Cidade, aeroporto ou código IATA'}
      </span>
    </div>
  );
}
