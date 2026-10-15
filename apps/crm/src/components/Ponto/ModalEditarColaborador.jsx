// src/components/Ponto/ModalEditarColaborador.jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';

const CARGOS_CAMPO = ['Campo', 'Facilities', 'TI', 'Sócio/Campo'];

async function chamarFuncao(nome, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke(nome, {
    body,
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  return res.data?.error || res.error?.message || null;
}

export default function ModalEditarColaborador({ emp, employees, onFechar, onMudou }) {
  const [nome, setNome] = useState(emp.name);
  const [cargo, setCargo] = useState(emp.cargo);
  const [contrato, setContrato] = useState(emp.contract_type);
  const [jornada, setJornada] = useState(String(emp.daily_hours));
  const [novaSenha, setNovaSenha] = useState('');
  const [novoUsuario, setNovoUsuario] = useState('');
  const [ocupado, setOcupado] = useState(null); // 'salvar' | 'senha' | 'acesso' | 'desativar'
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const overlayClose = useOverlayClose(onFechar);
  const temLogin = !!emp.auth_user_id;

  async function salvar() {
    setErro(null); setOk(null);
    const nomeLimpo = nome.trim();
    const horas = parseFloat(jornada);
    if (!nomeLimpo || !cargo.trim()) { setErro('Preencha nome e cargo'); return; }
    if (!horas || horas <= 0) { setErro('Informe a jornada diária'); return; }
    if (employees.some((e) => e.id !== emp.id && e.name.toLowerCase() === nomeLimpo.toLowerCase())) {
      setErro('Já existe um colaborador com esse nome'); return;
    }
    setOcupado('salvar');
    const { error } = await supabase.from('employees').update({
      name: nomeLimpo, cargo: cargo.trim(), contract_type: contrato, daily_hours: horas,
    }).eq('id', emp.id);
    setOcupado(null);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    await onMudou(`✓ ${nomeLimpo} atualizado(a)`);
  }

  async function redefinirSenha() {
    setErro(null); setOk(null);
    if (novaSenha.length < 6) { setErro('Senha com no mínimo 6 caracteres'); return; }
    setOcupado('senha');
    const msg = await chamarFuncao('admin-reset-password', { user_id: emp.auth_user_id, nova_senha: novaSenha });
    setOcupado(null);
    if (msg) { setErro('Erro ao redefinir senha: ' + msg); return; }
    setNovaSenha('');
    setOk('Senha redefinida.');
  }

  async function criarAcesso() {
    setErro(null); setOk(null);
    const user = novoUsuario.trim().toLowerCase();
    if (!user) { setErro('Preencha o usuário de login'); return; }
    if (novaSenha.length < 6) { setErro('Senha com no mínimo 6 caracteres'); return; }
    if (employees.some((e) => (e.username || '').toLowerCase() === user)) {
      setErro('Esse usuário de login já está em uso'); return;
    }
    setOcupado('acesso');
    const msg = await chamarFuncao('create-user', { username: user, password: novaSenha, employee_id: emp.id });
    setOcupado(null);
    if (msg) { setErro('Erro ao criar acesso: ' + msg); return; }
    await onMudou(`✓ Acesso criado para ${emp.name} (login: "${user}")`);
  }

  async function desativar() {
    if (!confirm(`Desativar ${emp.name}?\n\nA pessoa some das listas e não consegue mais entrar no app Ponto. O histórico de ponto continua guardado e você pode reativar depois.`)) return;
    setErro(null); setOk(null);
    setOcupado('desativar');
    const { error } = await supabase.from('employees').update({ ativo: false }).eq('id', emp.id);
    setOcupado(null);
    if (error) { setErro('Erro ao desativar: ' + error.message); return; }
    await onMudou(`${emp.name} desativado(a). Dá pra reativar em "Colaboradores desativados".`);
  }

  return (
    <div className="ponto-modal-overlay" {...overlayClose}>
      <div className="ponto-modal">
        <header className="ponto-modal__header">
          <div>
            <h3 className="ponto-modal__titulo">Editar colaborador</h3>
            <p className="ponto-modal__sub">
              {temLogin ? `Login: ${emp.username || '—'}` : 'Sem login no app Ponto'}
            </p>
          </div>
          <button className="ponto-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ponto-modal__corpo">
          <div className="ponto-modal__add" style={{ borderTop: 'none', paddingTop: 0 }}>
            <input
              type="text" className="ponto-modal__obs-input" placeholder="Nome completo"
              value={nome} onChange={(e) => setNome(e.target.value)}
            />
            <div className="ponto-modal__add-linha">
              <input
                type="text" list="ponto-cargos-edit" placeholder="Cargo"
                value={cargo} onChange={(e) => setCargo(e.target.value)}
              />
              <datalist id="ponto-cargos-edit">
                {CARGOS_CAMPO.map((c) => <option key={c} value={c} />)}
              </datalist>
              <select value={contrato} onChange={(e) => setContrato(e.target.value)}>
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="Estágio">Estágio</option>
              </select>
            </div>
            <input
              type="number" step="0.5" min="1" className="ponto-modal__obs-input"
              placeholder="Jornada diária (horas)"
              value={jornada} onChange={(e) => setJornada(e.target.value)}
            />
            <button className="ponto__btn ponto__btn--ok" disabled={!!ocupado} onClick={salvar}>
              {ocupado === 'salvar' ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>

          <div className="ponto-modal__add">
            <strong className="ponto-modal__secao">{temLogin ? 'Redefinir senha' : 'Criar acesso ao app Ponto'}</strong>
            {!temLogin && (
              <input
                type="text" className="ponto-modal__obs-input" placeholder="Usuário (login)"
                autoCapitalize="none" autoComplete="off"
                value={novoUsuario} onChange={(e) => setNovoUsuario(e.target.value)}
              />
            )}
            <input
              type="text" className="ponto-modal__obs-input"
              placeholder={temLogin ? 'Nova senha' : 'Senha'} autoComplete="off"
              value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
            />
            <button
              className="ponto__btn ponto__btn--ok" disabled={!!ocupado}
              onClick={temLogin ? redefinirSenha : criarAcesso}
            >
              {temLogin
                ? (ocupado === 'senha' ? 'Redefinindo...' : 'Redefinir senha')
                : (ocupado === 'acesso' ? 'Criando...' : 'Criar acesso')}
            </button>
          </div>

          {erro && <p className="ponto-modal__erro">{erro}</p>}
          {ok && <p className="ponto-modal__ok">{ok}</p>}

          <div className="ponto-modal__add">
            <button className="ponto__btn ponto__btn--rec" disabled={!!ocupado} onClick={desativar}>
              {ocupado === 'desativar' ? 'Desativando...' : 'Desativar colaborador'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
