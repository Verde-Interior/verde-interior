// src/components/CeasaHolambra/ArquivosProposta.jsx
// Upload e histórico de arquivos de proposta enviados a um lead do pipeline
// Ceasa/Holambra. Guarda todas as versões enviadas (não sobrescreve), pois
// proposta costuma ter revisão/reenvio.
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast/Toast';
import './ArquivosProposta.css';

function formatarTamanho(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ArquivosProposta({ prospectId, destaque }) {
  const toast = useToast();
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('ceasa_prospect_arquivos')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('enviado_em', { ascending: false });
    if (!error) setArquivos(data ?? []);
  }, [prospectId]);

  useEffect(() => { if (prospectId) carregar(); }, [prospectId, carregar]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const path = `${prospectId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('ceasa-propostas').upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('ceasa_prospect_arquivos').insert({
        prospect_id: prospectId, nome_arquivo: file.name, storage_path: path, tamanho_bytes: file.size,
      });
      if (dbErr) throw dbErr;
      toast.ok('Arquivo anexado');
      carregar();
    } catch (err) {
      toast.erro('Erro ao enviar arquivo: ' + err.message);
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function abrir(arq) {
    const { data, error } = await supabase.storage.from('ceasa-propostas').createSignedUrl(arq.storage_path, 300);
    if (error || !data?.signedUrl) { toast.erro('Erro ao abrir arquivo'); return; }
    window.open(data.signedUrl, '_blank', 'noreferrer');
  }

  async function excluir(arq) {
    if (!confirm(`Excluir "${arq.nome_arquivo}"?`)) return;
    await supabase.storage.from('ceasa-propostas').remove([arq.storage_path]);
    const { error } = await supabase.from('ceasa_prospect_arquivos').delete().eq('id', arq.id);
    if (error) { toast.erro('Erro ao excluir arquivo'); return; }
    toast.ok('Arquivo removido');
    carregar();
  }

  return (
    <div className={`arquivos-proposta ${destaque ? 'arquivos-proposta--destaque' : ''}`}>
      <div className="arquivos-proposta__header">
        <span className="arquivos-proposta__titulo">📎 Propostas enviadas</span>
        <label className="arquivos-proposta__btn-add">
          {enviando ? 'Enviando...' : '+ Anexar arquivo'}
          <input ref={fileRef} type="file" onChange={handleUpload} disabled={enviando} hidden />
        </label>
      </div>
      {arquivos.length === 0 ? (
        <p className="arquivos-proposta__vazio">Nenhum arquivo anexado ainda.</p>
      ) : (
        <ul className="arquivos-proposta__lista">
          {arquivos.map((arq) => (
            <li key={arq.id} className="arquivos-proposta__item">
              <button type="button" className="arquivos-proposta__nome" onClick={() => abrir(arq)} title="Abrir arquivo">
                📄 {arq.nome_arquivo}
              </button>
              <span className="arquivos-proposta__meta">
                {formatarData(arq.enviado_em)} · {formatarTamanho(arq.tamanho_bytes)}
              </span>
              <button type="button" className="arquivos-proposta__excluir" onClick={() => excluir(arq)} title="Excluir arquivo">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
