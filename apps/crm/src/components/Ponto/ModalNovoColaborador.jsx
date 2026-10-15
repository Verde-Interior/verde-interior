// src/components/Ponto/ModalNovoColaborador.jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';

const CARGOS_CAMPO = ['Campo', 'Facilities', 'TI', 'Sócio/Campo'];

export default function ModalNovoColaborador({ employees, onFechar, onCriado }) {
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('Campo');
  const [contrato, setContrato] = useState('CLT');
  const [jornada, setJornada] = useState('8');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const overlayClose = useOverlayClose(onFechar);

  async function salvar() {
    setErro(null);
    const nomeLimpo = nome.trim();
    const user = usuario.trim().toLowerCase();
    const horas = parseFloat(jornada);

    if (!nomeLimpo || !cargo.trim()) { setErro('Preencha nome e cargo'); return; }
    if (!horas || horas <= 0) { setErro('Informe a jornada diária'); return; }
    if (!user) { setErro('Preencha o usuário de login'); return; }
    if (senha.length < 6) { setErro('Senha com no mínimo 6 caracteres'); return; }
    if (employees.some((e) => e.name.toLowerCase() === nomeLimpo.toLowerCase())) {
      setErro('Já existe um colaborador com esse nome'); return;
    }
    if (employees.some((e) => (e.username || '').toLowerCase() === user)) {
      setErro('Esse usuário de login já está em uso'); return;
    }

    setSalvando(true);
    const { data: emp, error: errEmp } = await supabase.from('employees').insert({
      name: nomeLimpo, cargo: cargo.trim(), contract_type: contrato, daily_hours: horas,
      bank_minutes: 0, worked_hours: 0, extra_hours: 0, due_hours: 0, days_worked: 0,
    }).select().single();
    if (errEmp) { setSalvando(false); setErro('Erro ao salvar colaborador: ' + errEmp.message); return; }

    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke('create-user', {
      body: { username: user, password: senha, employee_id: emp.id },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setSalvando(false);

    if (res.error || res.data?.error) {
      // Colaborador já existe no banco; só o login falhou.
      setErro('Colaborador salvo, mas deu erro ao criar o login: '
        + (res.data?.error || res.error?.message)
        + '. Crie o acesso depois pelo app Ponto (Config).');
      await onCriado({ fechar: false });
      return;
    }

    await onCriado({ fechar: true, nome: nomeLimpo, usuario: user });
  }

  return (
    <div className="ponto-modal-overlay" {...overlayClose}>
      <div className="ponto-modal">
        <header className="ponto-modal__header">
          <div>
            <h3 className="ponto-modal__titulo">Novo colaborador</h3>
            <p className="ponto-modal__sub">Cadastro no ponto + login do app</p>
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
                type="text" list="ponto-cargos" placeholder="Cargo"
                value={cargo} onChange={(e) => setCargo(e.target.value)}
              />
              <datalist id="ponto-cargos">
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
            <div className="ponto-modal__add-linha">
              <input
                type="text" placeholder="Usuário (login)" autoCapitalize="none" autoComplete="off"
                value={usuario} onChange={(e) => setUsuario(e.target.value)}
              />
              <input
                type="text" placeholder="Senha" autoComplete="off"
                value={senha} onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <p className="ponto__vazio" style={{ margin: 0 }}>
              Cargo "Campo" faz a pessoa aparecer na Escala de Campo.
            </p>
            {erro && <p className="ponto-modal__erro">{erro}</p>}
            <button className="ponto__btn ponto__btn--ok" disabled={salvando} onClick={salvar}>
              {salvando ? 'Salvando...' : 'Cadastrar colaborador'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
