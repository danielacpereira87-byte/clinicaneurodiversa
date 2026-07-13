/* Neurodiversa — Sistema Clínico */

/* ═══ MÓDULO UPLOAD DE DOCUMENTOS ═══ */


/* ═══ UPLOAD DE DOCUMENTOS ══════════════════════════════════════ */
function uploadDocumento(input, tipo, nomeElId) {
  if (!input.files || !input.files[0]) return;
  if (!PAC.atual) { alert('Abra um paciente primeiro.'); return; }

  var file = input.files[0];
  var maxMB = 5;
  if (file.size > maxMB * 1024 * 1024) {
    alert('Arquivo muito grande. Maximo ' + maxMB + 'MB.');
    input.value = '';
    return;
  }

  var nomeEl = document.getElementById(nomeElId);
  if (nomeEl) nomeEl.textContent = 'Enviando ' + file.name + '...';

  /* Limpar nome do arquivo */
  var ext = file.name.split('.').pop().toLowerCase();
  var nomeSeguro = tipo + '_' + Date.now() + '.' + ext;
  var path = PAC.atual.id + '/' + nomeSeguro;

  getSB().storage.from('documentos').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  }).then(function(r) {
    if (r.error) {
      /* Se o bucket nao existe, salvar referencia local */
      if (r.error.message && r.error.message.includes('bucket')) {
        if (nomeEl) nomeEl.textContent = file.name + ' (salvar no banco)';
        salvarRefDocumento(tipo, file.name, path);
      } else {
        if (nomeEl) nomeEl.textContent = '';
        alert('Erro no upload: ' + r.error.message);
      }
      return;
    }
    var url = getSB().storage.from('documentos').getPublicUrl(path).data.publicUrl;
    if (nomeEl) nomeEl.textContent = file.name + ' ✓';
    salvarRefDocumento(tipo, file.name, url);
    toast(file.name + ' enviado!');
    carregarDocumentos(PAC.atual.id);
  });
}

function salvarRefDocumento(tipo, nome, url) {
  if (!PAC.atual) return;
  getSB().from('documentos').insert({
    clinic_id:  APP.clinicId,
    patient_id: PAC.atual.id,
    tipo:       tipo,
    nome:       nome,
    url:        url,
    criado_por: APP.user ? APP.user.id : null
  }).then(function(r) {
    if (!r.error) carregarDocumentos(PAC.atual.id);
  });
}

function carregarDocumentos(patId) {
  getSB().from('documentos').select('id,tipo,nome,url,criado_em')
    .eq('patient_id', patId).order('criado_em', {ascending:false})
    .then(function(r) {
      var c = document.getElementById('listaDocumentos'); if (!c) return;
      var d = r.data || [];
      if (!d.length) {
        c.innerHTML = '<div style="font-size:12px;color:#94A3B8;text-align:center;padding:14px;">Nenhum documento enviado ainda.</div>';
        return;
      }
      var tipoLabel = {
        carteirinha:'Carteirinha', laudo:'Laudo', relatorio:'Relatorio', outro:'Outro'
      };
      var tipoIcon = {
        carteirinha:'ti-id-badge', laudo:'ti-file-text', relatorio:'ti-chart-bar', outro:'ti-file-plus'
      };
      c.innerHTML = '<div style="font-size:11.5px;font-weight:600;color:#374151;margin-bottom:8px;">Documentos enviados:</div>' +
        d.map(function(doc) {
          var lbl = tipoLabel[doc.tipo] || doc.tipo;
          var ico = tipoIcon[doc.tipo] || 'ti-file';
          return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:6px;">'+
            '<i class="ti '+ico+'" style="color:#2563A8;font-size:15px;flex-shrink:0"></i>'+
            '<div style="flex:1">'+
              '<div style="font-size:12px;font-weight:500">'+esc(doc.nome)+'</div>'+
              '<div style="font-size:11px;color:#94A3B8">'+lbl+' &middot; '+new Date(doc.criado_em).toLocaleDateString('pt-BR')+'</div>'+
            '</div>'+
            (doc.url && doc.url.startsWith('http') ?
              '<a href="'+doc.url+'" target="_blank" class="btn btn-o btn-sm"><i class="ti ti-external-link"></i> Ver</a>' : '')+
          '</div>';
        }).join('');
    });
}

/* Atualizar salvarFicha para incluir especialidades */







/* === DASHBOARD COMPLETO COM DADOS REAIS === */
function carregarDashboard() {
  if (!APP.clinicId) return;
  var hoje = new Date().toISOString().split('T')[0];

  /* Pacientes ativos */
  getSB().from('patients').select('id', {count:'exact', head:true})
    .eq('clinic_id', APP.clinicId).eq('ativo', true)
    .then(function(r) {
      var el = document.getElementById('stPacientes');
      if (el) el.textContent = r.count !== null ? r.count : 0;
    });

  /* Agenda de hoje */
  getSB().from('appointments')
    .select('id,data_hora_ini,status,patients(nome),professionals(nome,especialidade)')
    .eq('clinic_id', APP.clinicId)
    .gte('data_hora_ini', hoje + 'T00:00:00')
    .lte('data_hora_ini', hoje + 'T23:59:59')
    .order('data_hora_ini')
    .limit(6)
    .then(function(r) {
      var el = document.getElementById('agendaHoje');
      if (!el) return;
      var sessoes = r.data || [];
      var el2 = document.getElementById('stSessoes');
      if (el2) el2.textContent = sessoes.length;

      if (!sessoes.length) {
        el.innerHTML = '<div style="font-size:12px;color:#94A3B8;text-align:center;padding:20px;">Nenhum atendimento hoje</div>';
        return;
      }
      var cores = {'Fonoaudiologia':'#378ADD','Terapia Ocupacional':'#1D9E75','ABA':'#D4537E','Neuropsicologia':'#7F77DD','Coordenação':'#BA7517'};
      var stMap = {agendado:'Agendado',confirmado:'Confirmado',realizado:'Realizado',cancelado:'Cancelado',falta_sem_aviso:'Faltou'};
      var stCls = {confirmado:'ok',realizado:'ok',cancelado:'fl',falta_sem_aviso:'fl',agendado:'pd'};
      el.innerHTML = sessoes.map(function(s) {
        var hora = s.data_hora_ini ? s.data_hora_ini.slice(11,16) : '--:--';
        var pac  = s.patients ? s.patients.nome : '—';
        var esp  = s.professionals ? (s.professionals.especialidade || s.professionals.nome) : '—';
        var cor  = cores[esp] || '#888';
        var cls  = stCls[s.status] || 'pd';
        var lbl  = stMap[s.status] || s.status;
        return '<div class="ai"><span style="font-size:11px;color:var(--mt);min-width:40px">'+hora+'</span>'+
          '<span class="ad" style="background:'+cor+'"></span>'+
          '<div style="flex:1"><div style="font-size:12px;font-weight:500">'+esc(pac)+'</div>'+
          '<div style="font-size:11px;color:var(--mt)">'+esc(esp)+'</div></div>'+
          '<span class="sb2 '+cls+'">'+lbl+'</span></div>';
      }).join('');
    });

  /* Pacientes do dia */
  getSB().from('patients')
    .select('id,nome,diagnostico_cid,data_nascimento')
    .eq('clinic_id', APP.clinicId).eq('ativo', true)
    .order('criado_em', {ascending:false})
    .limit(4)
    .then(function(r) {
      var el = document.getElementById('pacientesDia');
      if (!el) return;
      var pacs = r.data || [];
      if (!pacs.length) {
        el.innerHTML = '<div style="font-size:12px;color:#94A3B8;text-align:center;padding:14px;">Nenhum paciente cadastrado</div>';
        return;
      }
      el.innerHTML = pacs.map(function(p) {
        var ini = iniciais ? iniciais(p.nome) : p.nome.charAt(0).toUpperCase();
        var cid = (p.diagnostico_cid||[]).join(', ');
        var idade = calcIdade ? calcIdade(p.data_nascimento) : null;
        return '<div class="ai"><div class="pa" style="width:28px;height:28px;font-size:11px;">'+ini+'</div>'+
          '<div style="flex:1"><div style="font-size:12px;font-weight:500">'+esc(p.nome)+'</div>'+
          '<div style="font-size:11px;color:var(--mt)">'+(cid||'Sem CID')+(idade?' · '+idade+'a':'')+'</div></div></div>';
      }).join('');
    });
}


window.onerror = function(msg, src, line, col, err) {
  console.error('ERRO CAPTURADO:', msg, '| src:', src, '| linha:', line, '| col:', col);
  return false;
};


/* ═══ MÓDULO UPLOAD (2) ═══ */


/* ═══ UPLOAD DE DOCUMENTOS ══════════════════════════════════════ */
function uploadDocumento(input, tipo, nomeElId) {
  if (!input.files || !input.files[0]) return;
  if (!PAC.atual) { alert('Abra um paciente primeiro.'); return; }

  var file = input.files[0];
  var maxMB = 5;
  if (file.size > maxMB * 1024 * 1024) {
    alert('Arquivo muito grande. Maximo ' + maxMB + 'MB.');
    input.value = '';
    return;
  }

  var nomeEl = document.getElementById(nomeElId);
  if (nomeEl) nomeEl.textContent = 'Enviando ' + file.name + '...';

  /* Limpar nome do arquivo */
  var ext = file.name.split('.').pop().toLowerCase();
  var nomeSeguro = tipo + '_' + Date.now() + '.' + ext;
  var path = PAC.atual.id + '/' + nomeSeguro;

  getSB().storage.from('documentos').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  }).then(function(r) {
    if (r.error) {
      /* Se o bucket nao existe, salvar referencia local */
      if (r.error.message && r.error.message.includes('bucket')) {
        if (nomeEl) nomeEl.textContent = file.name + ' (salvar no banco)';
        salvarRefDocumento(tipo, file.name, path);
      } else {
        if (nomeEl) nomeEl.textContent = '';
        alert('Erro no upload: ' + r.error.message);
      }
      return;
    }
    var url = getSB().storage.from('documentos').getPublicUrl(path).data.publicUrl;
    if (nomeEl) nomeEl.textContent = file.name + ' ✓';
    salvarRefDocumento(tipo, file.name, url);
    toast(file.name + ' enviado!');
    carregarDocumentos(PAC.atual.id);
  });
}

function salvarRefDocumento(tipo, nome, url) {
  if (!PAC.atual) return;
  getSB().from('documentos').insert({
    clinic_id:  APP.clinicId,
    patient_id: PAC.atual.id,
    tipo:       tipo,
    nome:       nome,
    url:        url,
    criado_por: APP.user ? APP.user.id : null
  }).then(function(r) {
    if (!r.error) carregarDocumentos(PAC.atual.id);
  });
}

function carregarDocumentos(patId) {
  getSB().from('documentos').select('id,tipo,nome,url,criado_em')
    .eq('patient_id', patId).order('criado_em', {ascending:false})
    .then(function(r) {
      var c = document.getElementById('listaDocumentos'); if (!c) return;
      var d = r.data || [];
      if (!d.length) {
        c.innerHTML = '<div style="font-size:12px;color:#94A3B8;text-align:center;padding:14px;">Nenhum documento enviado ainda.</div>';
        return;
      }
      var tipoLabel = {
        carteirinha:'Carteirinha', laudo:'Laudo', relatorio:'Relatorio', outro:'Outro'
      };
      var tipoIcon = {
        carteirinha:'ti-id-badge', laudo:'ti-file-text', relatorio:'ti-chart-bar', outro:'ti-file-plus'
      };
      c.innerHTML = '<div style="font-size:11.5px;font-weight:600;color:#374151;margin-bottom:8px;">Documentos enviados:</div>' +
        d.map(function(doc) {
          var lbl = tipoLabel[doc.tipo] || doc.tipo;
          var ico = tipoIcon[doc.tipo] || 'ti-file';
          return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:6px;">'+
            '<i class="ti '+ico+'" style="color:#2563A8;font-size:15px;flex-shrink:0"></i>'+
            '<div style="flex:1">'+
              '<div style="font-size:12px;font-weight:500">'+esc(doc.nome)+'</div>'+
              '<div style="font-size:11px;color:#94A3B8">'+lbl+' &middot; '+new Date(doc.criado_em).toLocaleDateString('pt-BR')+'</div>'+
            '</div>'+
            (doc.url && doc.url.startsWith('http') ?
              '<a href="'+doc.url+'" target="_blank" class="btn btn-o btn-sm"><i class="ti ti-external-link"></i> Ver</a>' : '')+
          '</div>';
        }).join('');
    });
}

/* Atualizar salvarFicha para incluir especialidades */







/* === DASHBOARD COMPLETO COM DADOS REAIS === */
function carregarDashboard() {
  if (!APP.clinicId) return;
  var hoje = new Date().toISOString().split('T')[0];

  /* Pacientes ativos */
  getSB().from('patients').select('id', {count:'exact', head:true})
    .eq('clinic_id', APP.clinicId).eq('ativo', true)
    .then(function(r) {
      var el = document.getElementById('stPacientes');
      if (el) el.textContent = r.count !== null ? r.count : 0;
    });

  /* Agenda de hoje */
  getSB().from('appointments')
    .select('id,data_hora_ini,status,patients(nome),professionals(nome,especialidade)')
    .eq('clinic_id', APP.clinicId)
    .gte('data_hora_ini', hoje + 'T00:00:00')
    .lte('data_hora_ini', hoje + 'T23:59:59')
    .order('data_hora_ini')
    .limit(6)
    .then(function(r) {
      var el = document.getElementById('agendaHoje');
      if (!el) return;
      var sessoes = r.data || [];
      var el2 = document.getElementById('stSessoes');
      if (el2) el2.textContent = sessoes.length;

      if (!sessoes.length) {
        el.innerHTML = '<div style="font-size:12px;color:#94A3B8;text-align:center;padding:20px;">Nenhum atendimento hoje</div>';
        return;
      }
      var cores = {'Fonoaudiologia':'#378ADD','Terapia Ocupacional':'#1D9E75','ABA':'#D4537E','Neuropsicologia':'#7F77DD','Coordenação':'#BA7517'};
      var stMap = {agendado:'Agendado',confirmado:'Confirmado',realizado:'Realizado',cancelado:'Cancelado',falta_sem_aviso:'Faltou'};
      var stCls = {confirmado:'ok',realizado:'ok',cancelado:'fl',falta_sem_aviso:'fl',agendado:'pd'};
      el.innerHTML = sessoes.map(function(s) {
        var hora = s.data_hora_ini ? s.data_hora_ini.slice(11,16) : '--:--';
        var pac  = s.patients ? s.patients.nome : '—';
        var esp  = s.professionals ? (s.professionals.especialidade || s.professionals.nome) : '—';
        var cor  = cores[esp] || '#888';
        var cls  = stCls[s.status] || 'pd';
        var lbl  = stMap[s.status] || s.status;
        return '<div class="ai"><span style="font-size:11px;color:var(--mt);min-width:40px">'+hora+'</span>'+
          '<span class="ad" style="background:'+cor+'"></span>'+
          '<div style="flex:1"><div style="font-size:12px;font-weight:500">'+esc(pac)+'</div>'+
          '<div style="font-size:11px;color:var(--mt)">'+esc(esp)+'</div></div>'+
          '<span class="sb2 '+cls+'">'+lbl+'</span></div>';
      }).join('');
    });

  /* Pacientes do dia */
  getSB().from('patients')
    .select('id,nome,diagnostico_cid,data_nascimento')
    .eq('clinic_id', APP.clinicId).eq('ativo', true)
    .order('criado_em', {ascending:false})
    .limit(4)
    .then(function(r) {
      var el = document.getElementById('pacientesDia');
      if (!el) return;
      var pacs = r.data || [];
      if (!pacs.length) {
        el.innerHTML = '<div style="font-size:12px;color:#94A3B8;text-align:center;padding:14px;">Nenhum paciente cadastrado</div>';
        return;
      }
      el.innerHTML = pacs.map(function(p) {
        var ini = iniciais ? iniciais(p.nome) : p.nome.charAt(0).toUpperCase();
        var cid = (p.diagnostico_cid||[]).join(', ');
        var idade = calcIdade ? calcIdade(p.data_nascimento) : null;
        return '<div class="ai"><div class="pa" style="width:28px;height:28px;font-size:11px;">'+ini+'</div>'+
          '<div style="flex:1"><div style="font-size:12px;font-weight:500">'+esc(p.nome)+'</div>'+
          '<div style="font-size:11px;color:var(--mt)">'+(cid||'Sem CID')+(idade?' · '+idade+'a':'')+'</div></div></div>';
      }).join('');
    });
}


window.onerror = function(msg, src, line, col, err) {
  console.error('ERRO CAPTURADO:', msg, '| src:', src, '| linha:', line, '| col:', col);
  return false;
};


/* ═══ MÓDULO AGENDA/CALENDÁRIO ═══ */

const evs=[
  {d:0,t:0,h:1,c:'ef',n:'Sofia M.',e:'Fonoaudiologia',tm:'08:00'},
  {d:0,t:1,h:1,c:'eto',n:'Pedro A.',e:'T. Ocupacional',tm:'09:00'},
  {d:0,t:2,h:1,c:'eab',n:'Beatriz S.',e:'ABA',tm:'10:00'},
  {d:0,t:3,h:1,c:'en',n:'Lucas R.',e:'Neuropsico',tm:'11:00'},
  {d:0,t:5,h:1,c:'eco',n:'Família Costa',e:'Orientação',tm:'13:00'},
  {d:1,t:0,h:1,c:'eab',n:'Sofia M.',e:'ABA',tm:'08:00'},
  {d:1,t:1,h:1,c:'ef',n:'Marina L.',e:'Fonoaudiologia',tm:'09:00'},
  {d:1,t:2,h:1,c:'eto',n:'Beatriz S.',e:'T. Ocupacional',tm:'10:00'},
  {d:1,t:5,h:2,c:'ebl',n:'Bloqueado',e:'Reunião equipe',tm:'13:00'},
  {d:2,t:0,h:1,c:'en',n:'Pedro A.',e:'Neuropsico',tm:'08:00'},
  {d:2,t:1,h:1,c:'ef',n:'Lucas R.',e:'Fonoaudiologia',tm:'09:00'},
  {d:2,t:3,h:1,c:'eab',n:'Sofia M.',e:'ABA',tm:'11:00'},
  {d:3,t:0,h:1,c:'eto',n:'Sofia M.',e:'T. Ocupacional',tm:'08:00'},
  {d:3,t:1,h:1,c:'eab',n:'Pedro A.',e:'ABA',tm:'09:00'},
  {d:3,t:4,h:1,c:'eco',n:'Família Mendes',e:'Orientação',tm:'12:00'},
  {d:4,t:0,h:1,c:'ef',n:'Beatriz S.',e:'Fonoaudiologia',tm:'08:00'},
  {d:4,t:1,h:1,c:'eto',n:'Lucas R.',e:'T. Ocupacional',tm:'09:00'},
  {d:4,t:3,h:1,c:'eab',n:'Marina L.',e:'ABA',tm:'11:00'},
];
const tms=['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
let wo=0;

function buildCal(){
  const r=document.getElementById('cal-rows');if(!r)return;r.innerHTML='';
  const tc=document.createElement('div');tc.className='cal-tc';
  tms.forEach(t=>{const s=document.createElement('div');s.className='cal-ts';s.textContent=t;tc.appendChild(s);});
  r.appendChild(tc);
  for(let d=0;d<5;d++){
    const col=document.createElement('div');col.className='cal-dc';
    tms.forEach((_,i)=>{const sl=document.createElement('div');sl.className='cal-sl';sl.onclick=()=>om('m-agenda');col.appendChild(sl);});
    evs.filter(e=>e.d===d).forEach(e=>{
      const el=document.createElement('div');el.className='cal-ev '+e.c;
      el.style.top=(e.t*50+2)+'px';el.style.height=(e.h*50-5)+'px';
      el.innerHTML='<div class="evn">'+e.n+'</div><div class="eve">'+e.e+'</div><div class="evt">'+e.tm+'</div>';
      el.onclick=ev=>{ev.stopPropagation();nav('prontuario');};
      col.appendChild(el);
    });
    r.appendChild(col);
  }
}

function wk(d){wo+=d;uwl();}
function wt(){wo=0;uwl();}
function uwl(){
  const b=new Date(2025,4,26);b.setDate(b.getDate()+wo*7);
  const e=new Date(b);e.setDate(e.getDate()+4);
  const m=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const l=document.getElementById('wl');
  if(l)l.textContent=b.getDate()+' '+m[b.getMonth()]+' — '+e.getDate()+' '+m[e.getMonth()]+' '+e.getFullYear();
}

function nav(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.sb-it').forEach(x=>x.classList.remove('on'));
  const el=document.getElementById('v-'+v);if(el)el.classList.add('on');
  document.querySelectorAll('.sb-it').forEach(i=>{
    const oc=i.getAttribute('onclick');if(oc&&oc.includes("'"+v+"'"))i.classList.add('on');
  });
  if(v==='agenda')buildCal();
  if(v==='graficos')btg();
  if(v==='pacientes')carregarPacientes();
}

function st(pfx,tab,el){
  const maps={pac:['dados','clinico','responsaveis','equipe','documentos'],aval:['aplicar','resultado','sugestao'],metas:['banco','pei','versoes'],graf:['registro','graficos','dashboard']};
  if(maps[pfx]){maps[pfx].forEach(t=>{const d=document.getElementById(pfx+'-'+t);if(d)d.style.display=t===tab?'block':'none';});}
  if(el){const p=el.closest('.vtabs');if(p)p.querySelectorAll('.vt').forEach(x=>x.classList.remove('on'));el.classList.add('on');}
}

function tk(id){
  const c=document.getElementById('c-'+id);const x=document.getElementById('x-'+id);
  const dn=c.classList.contains('dn');
  if(dn){c.classList.remove('dn');c.innerHTML='';x.classList.remove('dn');}
  else{c.classList.add('dn');c.innerHTML='<i class="ti ti-check" style="font-size:9px;color:var(--vd)"></i>';x.classList.add('dn');}
}

function sc(btn,cls){
  const row=btn.closest('div');
  row.querySelectorAll('.sc2').forEach(b=>b.classList.remove('ac'));
  btn.classList.add('ac');upav();
}
function upav(){
  const d=document.querySelectorAll('.sc2.s2.ac').length;
  const e=document.querySelectorAll('.sc2.s1.ac').length;
  const a=document.querySelectorAll('.sc2.s0.ac').length;
  const cd=document.getElementById('cd');const ce2=document.getElementById('ce');const ca=document.getElementById('ca');
  if(cd)cd.textContent=d;if(ce2)ce2.textContent=e;if(ca)ca.textContent=a;
}

function tm(id,name){
  const c=document.getElementById(id);if(!c)return;
  const chk=c.querySelector('.mcc');const sel=c.classList.toggle('sel');
  if(chk)chk.innerHTML=sel?'<i class="ti ti-check" style="font-size:9px;color:#fff"></i>':'';
}

function esp(e,el){
  document.querySelectorAll('.esp-si').forEach(i=>i.classList.remove('on'));el.classList.add('on');
  const nm={fono:'Fonoaudiologia',aba:'ABA',to:'T. Ocupacional',coord:'Coordenação'};
  const pr={fono:'Dra. Ana Lima',aba:'Dra. Paula Neves',to:'Dr. Carlos R.',coord:'Dani C.'};
  const pp=document.getElementById('pp');const pe=document.getElementById('pe');
  if(pp)pp.textContent=pr[e];if(pe)pe.textContent=nm[e];nevo();
}
function nevo(){
  const n=document.getElementById('e-nova');const h=document.getElementById('e-hist');
  if(n)n.style.display='block';if(h)h.style.display='none';
}
function lsess(d){
  const n=document.getElementById('e-nova');const h=document.getElementById('e-hist');
  if(n)n.style.display='none';if(h)h.style.display='block';
  const hd=document.getElementById('hd-d');if(hd)hd.textContent=d;
}
let spdone=false;
function assp(){
  if(spdone)return;spdone=true;
  const sf=document.getElementById('sf-p');const t=document.getElementById('sft-p');
  if(sf)sf.classList.add('ok');
  if(t)t.innerHTML='<i class="ti ti-check"></i> Assinado digitalmente — 27/05/2025 14:47';
}

const ts=new Array(10).fill(0);
const tcls=['','A','E','P','N'];
const tclsn=['','acerto','erro','prompt','na'];
function btg(){
  const g=document.getElementById('tent-g');if(!g)return;g.innerHTML='';
  ts.forEach((s,i)=>{
    const btn=document.createElement('button');
    btn.className='tent-btn'+(s>0?' '+tclsn[s]:'');
    btn.textContent=s>0?tcls[s]:(i+1);
    btn.onclick=()=>{ts[i]=(ts[i]+1)%5;btg();};
    g.appendChild(btn);
  });
}

function om(id){document.getElementById(id).style.display='flex';}
function cm(id){document.getElementById(id).style.display='none';}

document.addEventListener('click',function(e){
  const vt=e.target.closest('.vt');
  if(vt){const p=vt.closest('.vtabs');if(p){p.querySelectorAll('.vt').forEach(x=>x.classList.remove('on'));vt.classList.add('on');}}
});

buildCal();uwl();


/* ═══ MÓDULO PACIENTES / DASHBOARD ═══ */

/* ======================================================
   NEURODIVERSA — Sistema Clinico v3.0
   ====================================================== */

/* --- Supabase --- */
var _sbInst = null;
function getSB() {
  if (!_sbInst) _sbInst = supabase.createClient('https://jvpkaxikkcthlxjuvrqg.supabase.co', 'sb_publishable_wV38k0smP_93ryzL7500BA_hoowuWSC', {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:false }
  });
  return _sbInst;
}

/* --- Estado global --- */
var APP = { user:null, perfil:null, role:null, clinicId:null };

/* --- PAC: estado dos pacientes --- */
var PAC = { lista:[], atual:null };

/* --- CID --- */
var CID_LIST = [
  {c:"F84.0",d:"Autismo Infantil"},
  {c:"F84.1",d:"Autismo Atipico"},
  {c:"F84.2",d:"Sindrome de Rett"},
  {c:"F84.3",d:"Outro Transtorno Desintegrativo da Infancia"},
  {c:"F84.4",d:"Transtorno com Hipercinesia Associada a Retardo Mental e Movimentos Estereotipados"},
  {c:"F84.5",d:"Sindrome de Asperger"},
  {c:"F84.8",d:"Outros Transtornos Globais do Desenvolvimento"},
  {c:"F84.9",d:"Transtorno Global do Desenvolvimento Nao Especificado"},
  {c:"F90.0",d:"Disturbio da Atividade e da Atencao"},
  {c:"F90.1",d:"Transtorno Hipercinetico de Conduta"},
  {c:"F90.8",d:"Outros Transtornos Hipercineticos"},
  {c:"F90.9",d:"Transtorno Hipercinetico Nao Especificado"},
  {c:"F80.0",d:"Transtorno Especifico da Articulacao da Fala"},
  {c:"F80.1",d:"Transtorno Expressivo de Linguagem"},
  {c:"F80.2",d:"Transtorno Receptivo de Linguagem"},
  {c:"F80.3",d:"Afasia Adquirida com Epilepsia - Sindrome de Landau-Kleffner"},
  {c:"F80.8",d:"Outros Transtornos do Desenvolvimento da Fala e da Linguagem"},
  {c:"F80.9",d:"Transtorno do Desenvolvimento da Fala e Linguagem Nao Especificado"},
  {c:"F81.0",d:"Transtorno Especifico de Leitura"},
  {c:"F81.1",d:"Transtorno Especifico da Soletrizacao"},
  {c:"F81.2",d:"Transtorno Especifico das Habilidades Aritmeticas"},
  {c:"F81.3",d:"Transtorno Misto das Habilidades Escolares"},
  {c:"F81.8",d:"Outros Transtornos do Desenvolvimento das Habilidades Escolares"},
  {c:"F81.9",d:"Transtorno do Desenvolvimento das Habilidades Escolares Nao Especificado"},
  {c:"F82",d:"Transtorno Especifico do Desenvolvimento Motor"},
  {c:"F70",d:"Retardo Mental Leve"},
  {c:"F71",d:"Retardo Mental Moderado"},
  {c:"F72",d:"Retardo Mental Grave"},
  {c:"F73",d:"Retardo Mental Profundo"},
  {c:"F78",d:"Outro Retardo Mental"},
  {c:"F79",d:"Retardo Mental Nao Especificado"},
  {c:"F91.0",d:"Disturbio de Conduta Restrito ao Contexto Familiar"},
  {c:"F91.1",d:"Disturbio de Conduta Nao Socializados"},
  {c:"F91.2",d:"Disturbio de Conduta Socializados"},
  {c:"F91.3",d:"Disturbio Desafiador e de Oposicao"},
  {c:"F93.0",d:"Transtorno de Ansiedade de Separacao da Infancia"},
  {c:"F93.1",d:"Transtorno de Ansiedade Fobica da Infancia"},
  {c:"F93.2",d:"Transtorno de Ansiedade Social da Infancia"},
  {c:"F93.8",d:"Outros Transtornos Emocionais da Infancia e Adolescencia"},
  {c:"F94.0",d:"Mutismo Seletivo"},
  {c:"F94.1",d:"Transtorno de Apego Reativo da Infancia"},
  {c:"F95.0",d:"Tique Transitorio"},
  {c:"F95.1",d:"Tique Motor ou Vocal Cronico"},
  {c:"F95.2",d:"Sindrome de Tourette"},
  {c:"F95.9",d:"Transtorno de Tique Nao Especificado"},
  {c:"F42.0",d:"Pensamentos ou Ruminacoes Obsessivas"},
  {c:"F42.1",d:"Atos Compulsivos - Rituais"},
  {c:"F42.2",d:"Pensamentos e Atos Obsessivos Mistos"},
  {c:"F42.8",d:"Outros Transtornos Obsessivo-Compulsivos"},
  {c:"F40.0",d:"Agorafobia"},
  {c:"F40.1",d:"Fobias Sociais"},
  {c:"F40.2",d:"Fobias Especificas - Isoladas"},
  {c:"F41.0",d:"Transtorno de Panico"},
  {c:"F41.1",d:"Ansiedade Generalizada"},
  {c:"F41.2",d:"Transtorno Misto Ansioso e Depressivo"},
  {c:"F32.0",d:"Episodio Depressivo Leve"},
  {c:"F32.1",d:"Episodio Depressivo Moderado"},
  {c:"F32.2",d:"Episodio Depressivo Grave sem Sintomas Psicoticos"},
  {c:"F33.0",d:"Transtorno Depressivo Recorrente - Episodio Atual Leve"},
  {c:"F33.1",d:"Transtorno Depressivo Recorrente - Episodio Atual Moderado"},
  {c:"G40.0",d:"Epilepsia e Sindromes Epilepticas Idiopaticas com Crises de Localizacao"},
  {c:"G40.1",d:"Epilepsia e Sindromes Epilepticas Sintomaticas com Crises Parciais Simples"},
  {c:"G40.2",d:"Epilepsia e Sindromes Epilepticas Sintomaticas com Crises Parciais Complexas"},
  {c:"G40.3",d:"Epilepsia e Sindromes Epilepticas Idiopaticas Generalizadas"},
  {c:"G40.4",d:"Outras Epilepsias Generalizadas"},
  {c:"G40.8",d:"Outras Epilepsias"},
  {c:"G40.9",d:"Epilepsia Nao Especificada"},
  {c:"G80.0",d:"Paralisia Cerebral Espastica Bilateral"},
  {c:"G80.1",d:"Paralisia Cerebral Espastica Diplegica"},
  {c:"G80.2",d:"Paralisia Cerebral Espastica Hemiplegica"},
  {c:"G80.3",d:"Paralisia Cerebral Discinetrica"},
  {c:"G80.4",d:"Paralisia Cerebral Ataxica"},
  {c:"G80.8",d:"Outros Tipos de Paralisia Cerebral"},
  {c:"G80.9",d:"Paralisia Cerebral Nao Especificada"},
  {c:"Q90.0",d:"Trissomia 21 - Nao Disjuncao Meiotica"},
  {c:"Q90.1",d:"Trissomia 21 - Mosaicismo"},
  {c:"Q90.2",d:"Trissomia 21 - Translocacao"},
  {c:"Q90.9",d:"Sindrome de Down Nao Especificada"},
  {c:"Q93.4",d:"Deleção do Braco Curto do Cromossomo 5 - Sindrome Cri-du-Chat"},
  {c:"R62.0",d:"Atraso no Desenvolvimento das Funcoes Esperadas para a Fase"},
  {c:"R62.8",d:"Outros Retardos do Desenvolvimento Fisiologico Normal"},
  {c:"G89.0",d:"Dor Central"},
  {c:"G93.4",d:"Encefalopatia Nao Especificada"},
  {c:"Z03.2",d:"Observacao por Suspeita de Transtorno Mental ou Comportamental"},
  {c:"Z13.3",d:"Rastreamento de Transtornos Mentais e Comportamentais"},
];


var _cidSel = {};

function cidBuscar(termo, idRes, idSel) {
  var c = document.getElementById(idRes); if(!c) return;
  if(!termo||termo.length<1){c.style.display='none';return;}
  var t = termo.toLowerCase();
  var res = CID_LIST.filter(function(x){return x.c.toLowerCase().includes(t)||x.d.toLowerCase().includes(t);}).slice(0,10);
  if(!res.length){c.style.display='none';return;}
  c.innerHTML = res.map(function(x){
    return '<div class="cid-item" '+
      'data-cod="'+x.c+'" data-desc="'+x.d+'" data-res="'+idRes+'" data-sel="'+idSel+'" '+
      'style="padding:9px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid #f1f5f9;display:flex;gap:8px;align-items:center;">'+
      '<span style="font-weight:700;color:#2563A8;min-width:56px;flex-shrink:0">'+x.c+'</span>'+
      '<span style="color:#374151;line-height:1.4">'+x.d+'</span>'+
    '</div>';
  }).join('');
  c.querySelectorAll('.cid-item').forEach(function(div){
    div.addEventListener('mouseover',function(){this.style.background='#EEF4FF';});
    div.addEventListener('mouseout',function(){this.style.background='';});
    div.addEventListener('click',function(){
      cidSel(this.dataset.cod, this.dataset.desc, this.dataset.res, this.dataset.sel);
    });
  });
  c.style.display='block';
}

function cidSel(cod, desc, idRes, idSel) {
  if(!_cidSel[idSel]) _cidSel[idSel]={};
  _cidSel[idSel][cod]=desc;
  cidRender(idSel);
  document.getElementById(idRes).style.display='none';
  var hid = idSel==='npCIDSel'?'npCID':'fpCID';
  document.getElementById(hid).value = Object.keys(_cidSel[idSel]).join(', ');
  var bid = idSel==='npCIDSel'?'npCIDBusca':'fpCIDBusca';
  document.getElementById(bid).value='';
}

function cidRender(idSel) {
  var c=document.getElementById(idSel); if(!c)return;
  var itens=_cidSel[idSel]||{};
  c.innerHTML=Object.entries(itens).map(function(e){
    return '<span class="cid-tag" style="display:inline-flex;align-items:center;gap:5px;background:#EEF4FF;color:#2563A8;border:1px solid #CBD5E1;border-radius:20px;padding:4px 12px;font-size:11.5px;font-weight:500;margin:2px;">'+
      '<strong>'+e[0]+'</strong>&nbsp;'+e[1]+
      '<span class="cid-rem" data-cod="'+e[0]+'" data-sel="'+idSel+'" style="cursor:pointer;color:#94A3B8;margin-left:4px;font-size:14px;line-height:1;">&times;</span></span>';
  }).join('');
  c.querySelectorAll('.cid-rem').forEach(function(span){
    span.addEventListener('click',function(){
      cidRem(this.dataset.cod, this.dataset.sel);
    });
  });
}

function cidRem(cod, idSel) {
  if(_cidSel[idSel]) delete _cidSel[idSel][cod];
  cidRender(idSel);
  var hid=idSel==='npCIDSel'?'npCID':'fpCID';
  document.getElementById(hid).value=Object.keys(_cidSel[idSel]||{}).join(', ');
}

function cidLoad(cids, idSel) {
  if(!cids||!cids.length)return;
  _cidSel[idSel]={};
  cids.forEach(function(cod){
    var item=CID_LIST.find(function(x){return x.c===cod;});
    _cidSel[idSel][cod]=item?item.d:cod;
  });
  cidRender(idSel);
}

document.addEventListener('click',function(e){
  ['npCIDRes','fpCIDRes'].forEach(function(id){
    var el=document.getElementById(id);
    if(el&&!el.contains(e.target))el.style.display='none';
  });
});

/* --- PERFIL E AUTENTICACAO --- */
function carregarPerfil() {
  console.log("carregarPerfil chamado, user:", APP.user ? APP.user.email : "null");
  if (!APP.user) return;
  getSB().from('user_profiles').select('id,nome,role,clinic_id,ativo')
    .eq('id', APP.user.id).single()
    .then(function(r) {
      if (r.error||!r.data) { console.error('Perfil:', r.error); mostrarLogin(); return; }
      APP.perfil   = r.data;
      APP.role     = r.data.role;
      APP.clinicId = r.data.clinic_id;
      var nome = r.data.nome || APP.user.email;
      setEl('sbNome', nome);
      setEl('sbAv', nome.charAt(0).toUpperCase());
      setEl('sbRole', {gestor:'Gestora',terapeuta:'Terapeuta',recepcao:'Recepcao',responsavel:'Responsavel'}[r.data.role]||r.data.role);
      var hora=new Date().getHours();
      var saud=hora<12?'Bom dia':hora<18?'Boa tarde':'Boa noite';
      setEl('dashGreet', saud+', '+nome.split(' ')[0]+' !');
      var d=new Date();
      var dias=['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];
      var meses=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      setEl('dashDate', dias[d.getDay()]+', '+d.getDate()+' de '+meses[d.getMonth()]+' de '+d.getFullYear());
      var loading=document.getElementById('pgLoading');
      var app=document.getElementById('appShell');
      if(loading) loading.style.display='none';
      if(app) app.style.display='grid';
      carregarPacientes();
      carregarDashboard();
    });
}

function mostrarLogin() {
  var ov=document.getElementById('loginOverlay');
  if(ov){ov.classList.remove('hidden');ov.style.display='flex';}
  var loading=document.getElementById('pgLoading');
  if(loading) loading.style.display='none';
}

function fazerLogout() {
  getSB().auth.signOut().then(function(){
    var app=document.getElementById('appShell');
    if(app)app.style.display='none';
    mostrarLogin();
  });
}

/* --- HELPERS --- */
function setEl(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
function setInp(id,v){var e=document.getElementById(id);if(e)e.value=(v===null||v===undefined)?'':v;}
function getInp(id){var e=document.getElementById(id);return e?e.value.trim():'';}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function toast(msg,tipo){
  var t=document.createElement('div');
  var bg=tipo==='erro'?'#EF4444':'#10B981';
  t.style.cssText='position:fixed;bottom:24px;right:24px;background:'+bg+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:99999;animation:fadein .2s';
  t.innerHTML='<i class="ti ti-'+(tipo==='erro'?'alert-circle':'check')+'" style="margin-right:6px"></i>'+msg;
  document.body.appendChild(t);
  setTimeout(function(){t.remove();},2500);
}

/* --- BOOT --- */
document.addEventListener('DOMContentLoaded', function() {
  // Forçar login a aparecer imediatamente
  mostrarLogin();
  // Mostrar login imediatamente
  mostrarLogin();
  getSB().auth.onAuthStateChange(function(event, session) {
    if (event==='SIGNED_OUT') { mostrarLogin(); return; }
    if ((event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED') && session && !APP.user) {
      APP.user = session.user;
      var ov=document.getElementById('loginOverlay');
      if(ov) ov.classList.add('hidden');
      carregarPerfil();
    }
  });
  getSB().auth.getSession().then(function(r) {
    if (r.data&&r.data.session) {
      APP.user = r.data.session.user;
      var ov=document.getElementById('loginOverlay');
      if(ov) ov.classList.add('hidden');
      carregarPerfil();
    } else {
      mostrarLogin();
    }
  });
});

/* --- MODULO PACIENTES --- */
function carregarPacientes() {
  if (!APP.clinicId) { setTimeout(carregarPacientes, 500); return; }
  getSB().from('patients').select('id,nome,nome_social,data_nascimento,sexo,diagnostico_cid,convenio,ativo')
    .eq('clinic_id', APP.clinicId).order('nome')
    .then(function(r) {
      PAC.lista = r.data||[];
      renderPacientes(PAC.lista);
      setEl('pacSubt', PAC.lista.length+' paciente(s)');
    });
}

function calcIdade(nasc){
  if(!nasc)return null;
  var h=new Date(),n=new Date(nasc),i=h.getFullYear()-n.getFullYear();
  if(h.getMonth()-n.getMonth()<0||(h.getMonth()-n.getMonth()===0&&h.getDate()<n.getDate()))i--;
  return i;
}
function iniciais(nome){
  if(!nome)return'??';
  var p=nome.trim().split(/\s+/);
  return p.length===1?p[0].slice(0,2).toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase();
}

function renderPacientes(lista) {
  var c=document.getElementById('pacLista');
  var vz=document.getElementById('pacVazio');
  if(!c)return;
  if(!lista.length){c.innerHTML='';if(vz)vz.style.display='block';return;}
  if(vz)vz.style.display='none';
  c.innerHTML=lista.map(function(p){
    var idade=calcIdade(p.data_nascimento);
    var idTxt=idade!==null?idade+' anos':'?';
    var cid=(p.diagnostico_cid||[]).join(', ');
    return '<div class="pac-card" data-id="'+p.id+'" '+
      'style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:13px 15px;margin-bottom:7px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s;">'+
      '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#27386A,#4A6FBF);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">'+iniciais(p.nome_social||p.nome)+'</div>'+
      '<div style="flex:1"><div style="font-size:13px;font-weight:500">'+esc(p.nome_social||p.nome)+'</div>'+
      '<div style="font-size:11px;color:#64748B">'+idTxt+(cid?' &middot; '+esc(cid):'')+(p.convenio?' &middot; '+esc(p.convenio):'')+'</div></div>'+
      '<span style="font-size:10px;padding:2px 8px;border-radius:20px;'+(p.ativo!==false?'background:#ECFDF5;color:#065F46':'background:#FEF2F2;color:#991B1B')+'">'+(p.ativo!==false?'Ativo':'Inativo')+'</span>'+
      '<i class="ti ti-chevron-right" style="color:#94A3B8;font-size:14px"></i></div>';
  }).join('');
  /* Listeners sem onclick inline */
  c.querySelectorAll('.pac-card').forEach(function(card){
    card.addEventListener('mouseover',function(){this.style.borderColor='#2563A8';});
    card.addEventListener('mouseout',function(){this.style.borderColor='#E2E8F0';});
    card.addEventListener('click',function(){abrirPaciente(this.dataset.id);});
  });
}

function filtrarPacientes(){
  var t=(document.getElementById('pacBusca').value||'').toLowerCase();
  renderPacientes(t?PAC.lista.filter(function(p){return(p.nome||'').toLowerCase().includes(t)||(p.nome_social||'').toLowerCase().includes(t);}):PAC.lista);
}

function abrirModalNovoPaciente(){
  if(!APP.pacienteId&&!APP.clinicId){alert('Aguarde o sistema carregar.');return;}
  ['npNome','npNasc','npConvenio'].forEach(function(id){setInp(id,'');});
  setInp('npSexo','');
  _cidSel['npCIDSel']={};cidRender('npCIDSel');
  setInp('npCID','');
  om('m-novo-paciente');
}

function criarPaciente(){
  var nome=getInp('npNome');
  if(!nome){alert('Informe o nome.');return;}
  if(!APP.clinicId){alert('Erro: clinica nao identificada. Recarregue a pagina.');return;}
  var nasc=getInp('npNasc')||null;
  var sexo=getInp('npSexo')||null;
  var cidRaw=getInp('npCID');
  var cid=cidRaw?cidRaw.split(',').map(function(s){return s.trim();}).filter(Boolean):null;
  var convenio=getInp('npConvenio')||null;
  var btn=document.getElementById('btnCriarPaciente');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2"></i> Criando...';}
  getSB().from('patients').insert({
    clinic_id: APP.clinicId,
    nome: nome,
    data_nascimento: nasc,
    sexo: sexo,
    diagnostico_cid: cid,
    convenio: convenio,
    ativo: true
  }).select().then(function(r){
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-check"></i> Criar paciente';}
    if(r.error){alert('Erro: '+r.error.message);return;}
    cm('m-novo-paciente');
    toast('Paciente criado!');
    carregarPacientes();
    if(r.data&&r.data[0]) abrirPaciente(r.data[0].id);
  });
}

function abrirPaciente(id){
  getSB().from('patients').select('*').eq('id',id).single().then(function(r){
    if(r.error||!r.data){alert('Erro ao carregar paciente.');return;}
    PAC.atual=r.data;
    preencherFicha(r.data);
    nav('paciente-ficha');
  });
}

function preencherFicha(p){
  var idade=calcIdade(p.data_nascimento);
  var cid=(p.diagnostico_cid||[]).join(', ');
  setEl('pfNome',p.nome_social||p.nome);
  setEl('pfSubt',(p.ativo!==false?'Paciente ativo':'Inativo')+(cid?' - '+cid:''));
  setEl('pfNomeMini',p.nome_social||p.nome);
  setEl('pfAvatar',iniciais(p.nome_social||p.nome));
  setEl('pfMeta',(idade!==null?idade+' anos':'')+(cid?' - '+cid:''));
  setInp('fpNome',p.nome);setInp('fpNomeSocial',p.nome_social);
  setInp('fpNasc',p.data_nascimento);setInp('fpSexo',p.sexo);
  setInp('fpCPF',p.cpf);setInp('fpCertidao',p.certidao);
  setInp('fpEndereco',p.endereco);setInp('fpCidade',p.cidade);
  setInp('fpEstado',p.estado);setInp('fpCEP',p.cep);
  setInp('fpEscola',p.escola);setInp('fpTurno',p.turno_escolar);
  setInp('fpCID',cid);setInp('fpDiagObs',p.diagnostico_obs);
  setInp('fpObsGerais',p.obs_gerais);setInp('fpConvenio',p.convenio);
  setInp('fpNumConvenio',p.numero_convenio);setInp('fpValConvenio',p.validade_convenio);
  cidLoad(p.diagnostico_cid||[],'fpCIDSel');
  carregarResponsaveis(p.id);
}

function excluirPaciente(){
  if(!PAC.atual)return;
  if(!confirm('Tem certeza que deseja excluir o cadastro de '+PAC.atual.nome+'? Esta acao nao pode ser desfeita.'))return;
  getSB().from('patients').update({ativo:false}).eq('id',PAC.atual.id).then(function(r){
    if(r.error){alert('Erro: '+r.error.message);return;}
    toast('Cadastro desativado.');
    nav('pacientes');
    carregarPacientes();
  });
}

function salvarFicha(){
  if(!PAC.atual)return;
  var cidRaw=getInp('fpCID');
  var cid=cidRaw?cidRaw.split(',').map(function(s){return s.trim();}).filter(Boolean):null;
  var dados={
    nome:getInp('fpNome'),nome_social:getInp('fpNomeSocial')||null,
    data_nascimento:getInp('fpNasc')||null,sexo:getInp('fpSexo')||null,
    cpf:getInp('fpCPF')||null,certidao:getInp('fpCertidao')||null,
    endereco:getInp('fpEndereco')||null,cidade:getInp('fpCidade')||null,
    estado:getInp('fpEstado')||null,cep:getInp('fpCEP')||null,
    escola:getInp('fpEscola')||null,turno_escolar:getInp('fpTurno')||null,
    diagnostico_cid:cid,diagnostico_obs:getInp('fpDiagObs')||null,
    obs_gerais:getInp('fpObsGerais')||null,convenio:getInp('fpConvenio')||null,
    numero_convenio:getInp('fpNumConvenio')||null,validade_convenio:getInp('fpValConvenio')||null,
    data_inicio_terapia:getInp('fpDataInicio')||null,
    data_saida_terapia:getInp('fpDataSaida')||null,
    coord_aba:getInp('fpCoordABA')||null,
    coord_aba_esp:getInp('fpCoordABAEsp')||null,
    coord_aba_cons:getInp('fpCoordABACons')||null,
    coord_fono:getInp('fpCoordFono')||null,
    coord_fono_esp:getInp('fpCoordFonoEsp')||null,
    coord_fono_cons:getInp('fpCoordFonoCons')||null,
    coord_to:getInp('fpCoordTO')||null,
    coord_to_esp:getInp('fpCoordTOEsp')||null,
    coord_to_cons:getInp('fpCoordTOCons')||null,
    supervisor_clinico:getInp('fpSupervisor')||null,
    supervisor_esp:getInp('fpSupervisorEsp')||null,
    supervisor_cons:getInp('fpSupervisorCons')||null
  };
  if(!dados.nome){alert('Nome obrigatorio.');return;}
  getSB().from('patients').update(dados).eq('id',PAC.atual.id).then(function(r){
    if(r.error){alert('Erro: '+r.error.message);return;}
    toast('Salvo!');
    PAC.atual=Object.assign(PAC.atual,dados);
    preencherFicha(PAC.atual);
    carregarPacientes();
  });
}

function carregarResponsaveis(patId){
  getSB().from('patient_guardians')
    .select('principal,guardians(id,nome,parentesco,telefone,email)')
    .eq('patient_id',patId)
    .then(function(r){
      var c=document.getElementById('pfResponsaveis');if(!c)return;
      var d=r.data||[];
      if(!d.length){c.innerHTML='<div style="font-size:12px;color:#64748B;text-align:center;padding:14px;">Nenhum responsavel.</div>';return;}
      var pl={mae:'Mae',pai:'Pai',avo_materna:'Avo materna',avo_paterna:'Avo paterna',tio:'Tio/Tia',tutor:'Tutor(a)',responsavel:'Responsavel',outro:'Outro'};
      c.innerHTML=d.map(function(it){
        var g=it.guardians;if(!g)return'';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">'+
          '<div style="width:32px;height:32px;border-radius:50%;background:#EEF4FF;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2563A8;flex-shrink:0;">'+iniciais(g.nome)+'</div>'+
          '<div style="flex:1"><div style="font-size:12px;font-weight:500">'+esc(g.nome)+'</div>'+
          '<div style="font-size:11px;color:#64748B">'+(pl[g.parentesco]||g.parentesco||'')+(it.principal?' - principal':'')+'</div></div>'+
          (g.telefone?'<span style="font-size:12px;color:#2563A8">'+esc(g.telefone)+'</span>':'')+
        '</div>';
      }).join('');
    });
}

function abrirModalResponsavel(){
  if(!PAC.atual){alert('Abra um paciente primeiro.');return;}
  ['nrNome','nrTelefone','nrEmail'].forEach(function(id){setInp(id,'');});
  document.getElementById('nrPrincipal').checked=false;
  om('m-novo-responsavel');
}

function criarResponsavel(){
  if(!PAC.atual)return;
  var nome=getInp('nrNome');if(!nome){alert('Informe o nome.');return;}
  var parentesco=document.getElementById('nrParentesco').value;
  var telefone=getInp('nrTelefone')||null;
  var email=getInp('nrEmail')||null;
  var principal=document.getElementById('nrPrincipal').checked;
  getSB().from('guardians').insert({clinic_id:APP.clinicId,nome:nome,parentesco:parentesco,telefone:telefone,email:email}).select()
    .then(function(r){
      if(r.error){alert('Erro: '+r.error.message);return;}
      getSB().from('patient_guardians').insert({clinic_id:APP.clinicId,patient_id:PAC.atual.id,guardian_id:r.data[0].id,principal:principal})
        .then(function(r2){
          if(r2.error){alert('Erro: '+r2.error.message);return;}
          cm('m-novo-responsavel');toast('Responsavel adicionado!');
          carregarResponsaveis(PAC.atual.id);
        });
    });
}


/* ═══ MÓDULO LOGIN ═══ */

function lLogin() {
  var email=document.getElementById('lEmail').value.trim();
  var senha=document.getElementById('lSenha').value;
  var al=document.getElementById('lAlerta');
  if(al)al.style.display='none';
  if(!email||!senha){if(al){al.innerHTML='<div style="background:#FEF2F2;border:1px solid #FECACA;color:#EF4444;padding:10px 13px;border-radius:8px;font-size:12px;">Preencha e-mail e senha.</div>';al.style.display='block';}return;}
  var btn=document.getElementById('lBtnLogin');
  btn.disabled=true;btn.textContent='Verificando...';
  getSB().auth.signInWithPassword({email:email,password:senha}).then(function(r){
    btn.disabled=false;btn.innerHTML='<i class="ti ti-login"></i> Entrar na plataforma';
    if(r.error){
      var msg=r.error.message.toLowerCase().includes('invalid')?'E-mail ou senha incorretos.':'Erro ao fazer login. Tente novamente.';
      if(al){al.innerHTML='<div style="background:#FEF2F2;border:1px solid #FECACA;color:#EF4444;padding:10px 13px;border-radius:8px;font-size:12px;">'+msg+'</div>';al.style.display='block';}
      document.getElementById('lSenha').value='';
      return;
    }
    APP.user=r.data.user;
    document.getElementById('loginOverlay').classList.add('hidden');
    carregarPerfil();
  });
}
document.addEventListener('DOMContentLoaded',function(){
  var le=document.getElementById('lEmail');
  var ls=document.getElementById('lSenha');
  if(le)le.addEventListener('keydown',function(e){if(e.key==='Enter'&&ls)ls.focus();});
  if(ls)ls.addEventListener('keydown',function(e){if(e.key==='Enter')lLogin();});
});


/* ═══ MÓDULO PRINCIPAL (AVALIAÇÃO / PEI / REGISTRO / RELATÓRIO) ═══ */

/* ═══════════════════════════════════════════════════
   MÓDULO DE AVALIAÇÃO
   ═══════════════════════════════════════════════════ */
var AV={paciente:null,avaliacao:null,dominios:[],itens:[],respostas:{},dominioAtual:null};

function abrirModuloAvaliacao(){
  if(!PAC.atual){alert('Abra um paciente primeiro.');return;}
  AV.paciente=PAC.atual;
  nav('avaliacoes');
  setTimeout(carregarAvaliacoesPaciente,50);
}

function carregarAvaliacoesPaciente(){
  if(!AV.paciente)return;
  // Limpar elementos dinâmicos do PEI/Resultados que possam estar na view
  ['avAplicacaoView','avResultadosView','avPEIView','avPEIGeradoView',
   'avRelatorioView','avPEIListaView','avPEISemPEIView'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.remove();
  });
  // Mostrar a lista estática de avaliações
  var avListaView=document.getElementById('avListaView');
  if(avListaView)avListaView.style.display='';
  var subEl=document.getElementById('avSubt');
  if(subEl)subEl.textContent=AV.paciente.nome;
  var btnNova=document.getElementById('btnNovaAv');
  if(btnNova)btnNova.style.display='';

  getSB().from('avaliacoes')
    .select('id,status,criado_em,protocolo_id,protocolo_templates(nome,sigla)')
    .eq('patient_id',AV.paciente.id)
    .eq('clinic_id',APP.clinicId)
    .order('criado_em',{ascending:false})
    .then(function(r){
      var el=document.getElementById('avLista');
      if(!el)return;
      var lista=r.data||[];
      if(!lista.length){
        el.innerHTML='<div style="text-align:center;color:#94A3B8;padding:40px;font-size:13px;"><i class="ti ti-clipboard-list" style="font-size:32px;display:block;margin-bottom:8px;"></i>Nenhuma avaliação. Clique em "+ Nova Avaliação".</div>';
        return;
      }
      var stCor={em_andamento:'#F59E0B',finalizada:'#10B981',concluida:'#10B981',cancelada:'#EF4444'};
      var stLabel={em_andamento:'Em andamento',finalizada:'Finalizada',concluida:'Finalizada',cancelada:'Cancelada'};
      el.innerHTML=lista.map(function(av){
        var prot=av.protocolo_templates?av.protocolo_templates.sigla:'—';
        var dt=new Date(av.criado_em).toLocaleDateString('pt-BR');
        var cor=stCor[av.status]||'#94A3B8';
        var lbl=stLabel[av.status]||av.status;
        var nomeProt=av.protocolo_templates?esc(av.protocolo_templates.nome):'—';
        return '<div data-avid="'+av.id+'" style="border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">'+
          '<div style="width:36px;height:36px;border-radius:8px;background:#EEF4FF;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#27386A;flex-shrink:0;">'+esc(prot)+'</div>'+
          '<div style="flex:1;cursor:pointer;" onclick="continuarAvaliacao(\''+av.id+'\')">' +
            '<div style="font-size:13px;font-weight:500;">'+nomeProt+'</div>'+
            '<div style="font-size:11px;color:#64748B;">'+dt+'</div>'+
          '</div>'+
          '<span style="font-size:11px;font-weight:600;color:'+cor+';margin-right:8px;">'+lbl+'</span>'+
          '<div style="position:relative;">'+
            '<button onclick="toggleMenuAv(this)" style="background:none;border:none;cursor:pointer;padding:4px 10px;color:#64748B;font-size:18px;font-weight:bold;">···</button>'+
            '<div class="menu-av" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:100;min-width:160px;">'+
              '<div onclick="continuarAvaliacao(\''+av.id+'\')" style="padding:10px 14px;cursor:pointer;font-size:12px;display:flex;gap:8px;"><i class="ti ti-eye"></i> '+(av.status==='finalizada'?'Ver Resultados':'Continuar')+'</div>'+
              '<div onclick="excluirAvaliacao(\''+av.id+'\')" style="padding:10px 14px;cursor:pointer;font-size:12px;color:#EF4444;display:flex;gap:8px;"><i class="ti ti-trash"></i> Excluir</div>'+
            '</div>'+
          '</div>'+
        '</div>';
      }).join('');
    });
}

function abrirNovaAvaliacao(){
  if(!AV.paciente)return;
  var modal=document.getElementById('avModalProtocolo');
  if(!modal)return;
  var nomEl=document.getElementById('avModalPacNome');
  if(nomEl)nomEl.textContent='Paciente: '+AV.paciente.nome;
  getSB().from('protocolo_templates').select('id,nome,sigla').eq('ativo',true)
    .then(function(r){
      var el=document.getElementById('avProtocoloLista');
      if(!el)return;
      var prots=r.data||[];
      var h='';
      prots.forEach(function(p){
        h+='<label style="border:1.5px solid #E2E8F0;border-radius:9px;padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer">'+
          '<input type="checkbox" name="av_protocolo" value="'+p.id+'" style="width:15px;height:15px;accent-color:#2563A8">'+
          '<div><div style="font-size:12.5px;font-weight:600">'+esc(p.sigla)+'</div>'+
          '<div style="font-size:11px;color:#64748B">'+esc(p.nome)+'</div></div></label>';
      });
      el.innerHTML=h;
    });
  modal.style.display='flex';
}

function fecharModalProtocolo(){
  var modal=document.getElementById('avModalProtocolo');
  if(modal)modal.style.display='none';
}

function iniciarAvaliacao(){
  var checks=document.querySelectorAll('input[name="av_protocolo"]:checked');
  if(!checks.length){alert('Selecione pelo menos um protocolo.');return;}
  var protId=checks[0].value;
  fecharModalProtocolo();
  getSB().from('avaliacoes').insert({
    clinic_id:APP.clinicId,
    patient_id:AV.paciente.id,
    protocolo_id:protId,
    data_aplicacao:new Date().toISOString().split('T')[0],
    status:'em_andamento'
  }).select().single().then(function(r){
    if(r.error){alert('Erro ao criar avaliação: '+r.error.message);return;}
    AV.avaliacao=r.data;
    AV.respostas={};
    carregarProtocoloParaAplicacao(protId);
  });
}

function continuarAvaliacao(avId){
  getSB().from('avaliacoes').select('*,protocolo_templates(id,nome,sigla)')
    .eq('id',avId).single().then(function(r){
      if(r.error||!r.data)return;
      AV.avaliacao=r.data;
      // Se já finalizada, abrir resultados direto
      if(r.data.status==='finalizada'){
        abrirResultados(avId);
        return;
      }
      getSB().from('avaliacao_respostas').select('item_id,pontuacao')
        .eq('avaliacao_id',avId).then(function(rr){
          AV.respostas={};
          var dados = rr.data||[];
          dados.forEach(function(resp){
            AV.respostas[String(resp.item_id)]=resp.pontuacao;
          });
          carregarProtocoloParaAplicacao(r.data.protocolo_id);
        });
    });
}

function carregarProtocoloParaAplicacao(protId){
  getSB().from('protocolo_dominios').select('id,nome,ordem')
    .eq('protocolo_id',protId).eq('ativo',true).order('ordem')
    .then(function(r){
      AV.dominios=r.data||[];
      getSB().from('protocolo_itens').select('id,dominio_id,codigo,descricao,pontuacao_max,ordem')
        .eq('protocolo_id',protId).eq('ativo',true).order('ordem')
        .then(function(ri){
          AV.itens=ri.data||[];
          mostrarTelaAplicacao();
        });
    });
}

function mostrarTelaAplicacao(){
  var lista=document.getElementById('avListaView');
  var aplic=document.getElementById('avAplicacaoView');
  if(lista)lista.style.display='none';
  if(aplic){aplic.style.display='flex';aplic.style.flexDirection='column';}
  var tit=document.getElementById('avAplTitulo');
  var sub=document.getElementById('avAplSubt');
  if(tit)tit.textContent=AV.paciente?AV.paciente.nome:'—';
  if(sub)sub.textContent='ABLLS-R · '+AV.dominios.length+' domínios · '+AV.itens.length+' itens';
  renderizarSidebarDominios();
  if(AV.dominios.length)selecionarDominio(AV.dominios[0].id);
  atualizarProgresso();
}

function renderizarSidebarDominios(){
  var domEl=document.getElementById('avDominioLista');
  if(!domEl)return;
  var h='';
  AV.dominios.forEach(function(dom){
    var itensDom=AV.itens.filter(function(it){return it.dominio_id===dom.id;});
    var respondidos=itensDom.filter(function(it){return AV.respostas[String(it.id)]!==undefined;}).length;
    var pct=itensDom.length?Math.round(respondidos/itensDom.length*100):0;
    var cor=pct===100?'#10B981':pct>0?'#F59E0B':'#94A3B8';
    h+='<div class="av-dom-item" data-id="'+dom.id+'" onclick="selecionarDominio(this.dataset.id)" '+
      'style="padding:8px 12px;cursor:pointer;border-left:3px solid transparent;font-size:11.5px">'+
      '<div style="font-weight:500;margin-bottom:3px">'+esc(dom.nome)+'</div>'+
      '<div class="av-dom-count" style="font-size:10px;color:'+cor+'">'+respondidos+'/'+itensDom.length+'</div>'+
      '</div>';
  });
  domEl.innerHTML=h;
}

function selecionarDominio(domId){
  AV.dominioAtual=domId;
  document.querySelectorAll('.av-dom-item').forEach(function(el){
    var ativo=el.dataset.id===domId;
    el.style.borderLeftColor=ativo?'#2563A8':'transparent';
    el.style.background=ativo?'#EEF4FF':'';
  });
  renderizarItensDominio();
}

function renderizarItensDominio(){
  var el=document.getElementById('avItemArea');
  if(!el)return;
  var dom=AV.dominios.find(function(d){return d.id===AV.dominioAtual;});
  var itensDom=AV.itens.filter(function(it){return it.dominio_id===AV.dominioAtual;});
  var labels=['Em Processo de Aprendizagem','Em Processo de Generalização','Intermediário','Avançado','Independente'];
  var cores=['#EF4444','#F59E0B','#3B82F6','#8B5CF6','#10B981'];
  var h='<div style="font-size:13px;font-weight:700;color:#2563A8;margin-bottom:16px;padding-bottom:10px;border-bottom:1.5px solid #E2E8F0">'+(dom?esc(dom.nome):'—')+'</div>';
  itensDom.forEach(function(item){
    var respAtual=AV.respostas[String(item.id)];
    var ptMax=item.pontuacao_max||4;
    var respondido=respAtual!==undefined;
    h+='<div style="border:1px solid '+(respondido?'#10B98133':'#E2E8F0')+';border-radius:10px;padding:14px;margin-bottom:10px;'+(respondido?'background:#F0FDF4':'')+'">';
    h+='<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">';
    h+='<span style="font-size:10px;font-weight:600;color:#94A3B8;background:#F1F5F9;padding:2px 6px;border-radius:4px;flex-shrink:0">'+esc(item.codigo)+'</span>';
    h+='<div style="font-size:12.5px;line-height:1.5;font-weight:500">'+esc(item.descricao)+'</div></div>';
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
    for(var pts=0;pts<=ptMax;pts++){
      var sel=respAtual===pts;
      var cor=cores[pts]||'#64748B';
      var lbl=labels[pts]||pts;
      h+='<button data-item="'+item.id+'" data-pts="'+pts+'" data-max="'+ptMax+'" onclick="registrarResposta(this.dataset.item,parseInt(this.dataset.pts),parseInt(this.dataset.max))" '+
        'style="padding:5px 10px;border-radius:6px;border:1.5px solid '+(sel?cor:'#E2E8F0')+';background:'+(sel?cor:'#fff')+';color:'+(sel?'#fff':'#374151')+';font-size:11px;font-weight:'+(sel?700:500)+';cursor:pointer" '+
        'title="'+lbl+'">'+pts+'</button>';
    }
    h+='</div>';
    if(respondido){
      h+='<div style="font-size:10.5px;color:#10B981;margin-top:6px;font-weight:500"><i class="ti ti-check"></i> Pontuação '+respAtual+' — '+(labels[respAtual]||respAtual)+'</div>';
    }
    h+='</div>';
  });
  el.innerHTML=h;
}

function registrarResposta(itemId,pontuacao,ptMax){
  AV.respostas[String(itemId)]=pontuacao;
  getSB().from('avaliacao_respostas').upsert({
    avaliacao_id:AV.avaliacao.id,
    item_id:itemId,
    pontuacao:pontuacao,
    clinic_id:APP.clinicId,
    patient_id:AV.paciente?AV.paciente.id:null,
    dominio_id:AV.dominioAtual||null,
    protocolo_id:AV.avaliacao?AV.avaliacao.protocolo_id:null,
    resposta:pontuacao>=4?'adquiriu':pontuacao>=2?'emergente':pontuacao===0?'nao_adquiriu':'emergente'
  },{onConflict:'avaliacao_id,item_id'}).then(function(r){
    if(r.error)console.error('Erro resposta:',r.error);
  });
  renderizarItensDominio();
  atualizarProgresso();
  renderizarSidebarDominios();
  // Re-highlight domínio atual
  document.querySelectorAll('.av-dom-item').forEach(function(el){
    var ativo=el.dataset.id===AV.dominioAtual;
    el.style.borderLeftColor=ativo?'#2563A8':'transparent';
    el.style.background=ativo?'#EEF4FF':'';
  });
}

function atualizarProgresso(){
  var total=AV.itens.length;
  var resp=Object.keys(AV.respostas).length;
  var pct=total?Math.round(resp/total*100):0;
  var barra=document.getElementById('avBarraProgresso');
  var prog=document.getElementById('avAplProgresso');
  if(barra)barra.style.width=pct+'%';
  if(prog)prog.textContent=resp+' de '+total+' itens ('+pct+'%)';
}

function voltarListaAvaliacoes(){
  var lista=document.getElementById('avListaView');
  var aplic=document.getElementById('avAplicacaoView');
  if(lista)lista.style.display='';
  if(aplic)aplic.style.display='none';
  carregarAvaliacoesPaciente();
}

function finalizarAvaliacao(){
  var total=AV.itens.length;
  var resp=Object.keys(AV.respostas).length;
  if(resp<total){
    if(!confirm('Ainda há '+(total-resp)+' itens sem pontuação. Deseja finalizar mesmo assim?'))return;
  }
  getSB().from('avaliacoes').update({status:'finalizada',data_finalizacao:new Date().toISOString()})
    .eq('id',AV.avaliacao.id).then(function(r){
      if(r.error){alert('Erro: '+r.error.message);return;}
      toast('Avaliação finalizada! ✓');
      setTimeout(function(){ abrirResultados(AV.avaliacao.id); }, 800);
    });
}

/* ═══════════════════════════════════════════════════
   DASHBOARD DE RESULTADOS DA AVALIAÇÃO
   ═══════════════════════════════════════════════════ */

function abrirResultados(avId) {
  // Buscar avaliação e respostas
  getSB().from('avaliacoes')
    .select('*,protocolo_templates(nome,sigla),patients(nome,data_nascimento,diagnostico_cid)')
    .eq('id', avId).single()
    .then(function(r) {
      if (r.error || !r.data) return;
      var av = r.data;
      
      // Buscar respostas com dados dos domínios
      getSB().from('avaliacao_respostas')
        .select('pontuacao,dominio_id,protocolo_dominios(nome,ordem)')
        .eq('avaliacao_id', avId)
        .then(function(rr) {
          var respostas = rr.data || [];
          gerarDashboardResultados(av, respostas);
        });
    });
}

function gerarDashboardResultados(av, respostas) {
  nav('avaliacoes');
  
  // Agrupar por domínio
  var dominios = {};
  respostas.forEach(function(r) {
    var nomeDom = r.protocolo_dominios ? r.protocolo_dominios.nome : 'Sem domínio';
    var ordem = r.protocolo_dominios ? r.protocolo_dominios.ordem : 99;
    if (!dominios[nomeDom]) {
      dominios[nomeDom] = { nome: nomeDom, ordem: ordem, adquirido: 0, emergente: 0, nao_adquirido: 0, total: 0 };
    }
    dominios[nomeDom].total++;
    var pts = r.pontuacao;
    if (pts >= 4) dominios[nomeDom].adquirido++;
    else if (pts >= 2) dominios[nomeDom].emergente++;
    else dominios[nomeDom].nao_adquirido++;
  });

  var domList = Object.values(dominios).sort(function(a,b){return a.ordem-b.ordem;});
  var totalResp = respostas.length;
  var totalAdq = respostas.filter(function(r){return r.pontuacao>=4;}).length;
  var totalEmg = respostas.filter(function(r){return r.pontuacao>=2&&r.pontuacao<4;}).length;
  var totalNao = respostas.filter(function(r){return r.pontuacao<2;}).length;

  var pacNome = av.patients ? av.patients.nome : '—';
  var protNome = av.protocolo_templates ? av.protocolo_templates.sigla : '—';
  var dt = av.data_aplicacao ? new Date(av.data_aplicacao).toLocaleDateString('pt-BR') : '—';

  var html = '<div id="avResultadosView" style="padding:20px;max-width:900px;margin:0 auto;">';
  
  // Cabeçalho
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">';
  html += '<button class="btn bo" onclick="voltarListaAvaliacoes()"><i class="ti ti-arrow-left"></i> Voltar</button>';
  html += '<div style="flex:1"><div style="font-size:16px;font-weight:700;">Resultados da Avaliação</div>';
  html += '<div style="font-size:12px;color:#64748B;">'+esc(pacNome)+' · '+esc(protNome)+' · '+dt+'</div></div>';
  html += '<button class="btn bp" data-avid="'+av.id+'" onclick="abrirPEI(this.dataset.avid)"><i class="ti ti-target"></i> Gerar PEI</button>';
  html += '<button class="btn bo" data-avid="'+av.id+'" onclick="abrirRelatorio(this.dataset.avid)"><i class="ti ti-file-text"></i> Relatório</button>';
  html += '</div>';

  // Cards resumo
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">';
  var cards = [
    {label:'Itens avaliados', val:totalResp, cor:'#2563A8', bg:'#EEF4FF'},
    {label:'Adquiridos', val:totalAdq, cor:'#10B981', bg:'#F0FDF4'},
    {label:'Em Processo de Generalizaçãos', val:totalEmg, cor:'#F59E0B', bg:'#FFFBEB'},
    {label:'Não adquiridos', val:totalNao, cor:'#EF4444', bg:'#FEF2F2'}
  ];
  cards.forEach(function(c) {
    html += '<div style="background:'+c.bg+';border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:28px;font-weight:700;color:'+c.cor+'">'+c.val+'</div>';
    html += '<div style="font-size:11px;color:#64748B;margin-top:3px;">'+c.label+'</div></div>';
  });
  html += '</div>';

  // Gráfico de barras por domínio
  html += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:16px;">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:14px;">Desempenho por Domínio</div>';
  
  domList.forEach(function(dom) {
    if (dom.total === 0) return;
    var pAdq = Math.round(dom.adquirido/dom.total*100);
    var pEmg = Math.round(dom.emergente/dom.total*100);
    var pNao = Math.round(dom.nao_adquirido/dom.total*100);
    
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">';
    html += '<span style="font-size:11.5px;font-weight:500;">'+esc(dom.nome)+'</span>';
    html += '<span style="font-size:10.5px;color:#64748B;">'+dom.adquirido+'/'+dom.total+' adquiridos</span>';
    html += '</div>';
    html += '<div style="height:12px;border-radius:6px;overflow:hidden;display:flex;background:#F1F5F9;">';
    if (pAdq > 0) html += '<div style="width:'+pAdq+'%;background:#10B981;transition:width .5s" title="Adquirido: '+pAdq+'%"></div>';
    if (pEmg > 0) html += '<div style="width:'+pEmg+'%;background:#F59E0B" title="Em Processo de Generalização: '+pEmg+'%"></div>';
    if (pNao > 0) html += '<div style="width:'+pNao+'%;background:#FCA5A5" title="Não adquirido: '+pNao+'%"></div>';
    html += '</div></div>';
  });

  // Legenda
  html += '<div style="display:flex;gap:16px;margin-top:10px;">';
  [['#10B981','Adquirido'],['#F59E0B','Em Processo de Generalização'],['#FCA5A5','Não adquirido']].forEach(function(l){
    html += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748B;">';
    html += '<div style="width:10px;height:10px;border-radius:2px;background:'+l[0]+'"></div>'+l[1]+'</div>';
  });
  html += '</div></div>';

  // Lista de itens não adquiridos (sugestão para PEI)
  var naoAdquiridos = respostas.filter(function(r){return r.pontuacao<2;});
  if (naoAdquiridos.length > 0) {
    html += '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:16px;margin-bottom:16px;">';
    html += '<div style="font-size:12px;font-weight:700;color:#DC2626;margin-bottom:10px;">';
    html += '<i class="ti ti-target"></i> '+naoAdquiridos.length+' itens sugeridos para o PEI</div>';
    html += '<div style="font-size:11.5px;color:#64748B;">Estes itens tiveram pontuação 0 ou 1 e são candidatos a metas no PEI.</div>';
    html += '<button class="btn bp" style="margin-top:12px;" data-avid="'+av.id+'" onclick="abrirPEI(this.dataset.avid)"><i class="ti ti-arrow-right"></i> Ir para o PEI</button>';
    html += '</div>';
  }

  html += '</div>';

  // Injetar na view de avaliações
  var lista = document.getElementById('avListaView');
  var aplic = document.getElementById('avAplicacaoView');
  if (lista) lista.style.display = 'none';
  if (aplic) aplic.style.display = 'none';

  var container = document.getElementById('v-avaliacoes');
  var existing = document.getElementById('avResultadosView');
  if (existing) existing.remove();
  
  var div = document.createElement('div');
  div.innerHTML = html;
  container.appendChild(div.firstChild);
}

/* ═══════════════════════════════════════════════════
   MÓDULO PEI v3 — todos os itens avaliados
   ═══════════════════════════════════════════════════ */

var PEI = {
  avaliacao: null,
  paciente: null,
  todosItens: [],           // todos os itens avaliados
  metasSelecionadas: {},    // item_id -> objeto meta
  momentos: [
    'Acolhimento','Jogos de Regras','Faz de Conta','Rotina Pedagógica',
    'Rotinas AVD','Motricidade','Leitura','Brincar Social','Lanche','Despedida'
  ]
};

function abrirPEI(avId) {
  getSB().from('avaliacoes')
    .select('*,protocolo_templates(nome,sigla),patients(nome,data_nascimento,diagnostico_cid)')
    .eq('id', avId).single()
    .then(function(r) {
      if (r.error || !r.data) { alert('Erro ao carregar avaliação.'); return; }
      PEI.avaliacao = r.data;
      PEI.paciente  = r.data.patients;

      // Buscar TODOS os itens avaliados com dados completos do protocolo
      getSB().from('avaliacao_respostas')
        .select('item_id,pontuacao,dominio_id,protocolo_id,protocolo_itens(codigo,descricao,descricao_meta,instrucao,pontuacao_max),protocolo_dominios(nome,ordem)')
        .eq('avaliacao_id', avId)
        .order('dominio_id')
        .then(function(rr) {
          PEI.todosItens = rr.data || [];
          PEI.metasSelecionadas = {};
          mostrarSelecaoMetas();
        });
    });
}

function mostrarSelecaoMetas() {
  nav('avaliacoes');
  var container = document.getElementById('v-avaliacoes');
  _limparViewsPEI();

  // Agrupar por domínio
  var porDominio = {};
  PEI.todosItens.forEach(function(item) {
    var dom = item.protocolo_dominios ? item.protocolo_dominios.nome : 'Sem domínio';
    var ord = item.protocolo_dominios ? item.protocolo_dominios.ordem : 99;
    if (!porDominio[dom]) porDominio[dom] = {nome:dom, ordem:ord, itens:[]};
    porDominio[dom].itens.push(item);
  });
  var doms = Object.values(porDominio).sort(function(a,b){return a.ordem-b.ordem;});
  var pacNome = PEI.paciente ? PEI.paciente.nome : '—';
  var total = PEI.todosItens.length;
  var naoAdq = PEI.todosItens.filter(function(i){return i.pontuacao < 2;}).length;

  var h = '<div id="avPEIView" style="padding:20px;max-width:960px;margin:0 auto;">';
  
  // Cabeçalho
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">';
  h += '<button class="btn bo" onclick="abrirResultados(\''+PEI.avaliacao.id+'\')"><i class="ti ti-arrow-left"></i> Voltar</button>';
  h += '<div style="flex:1"><div style="font-size:16px;font-weight:700;">Seleção de Metas — PEI</div>';
  h += '<div style="font-size:12px;color:#64748B;">'+esc(pacNome)+' · '+total+' itens avaliados · '+naoAdq+' sugeridos</div></div>';
  h += '<button class="btn bp" onclick="gerarPEI()"><i class="ti ti-arrow-right"></i> Gerar PEI</button></div>';

  // Info
  h += '<div style="background:#EEF4FF;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#1e40af;display:flex;gap:16px;flex-wrap:wrap;">';
  h += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#EF4444;margin-right:4px;"></span>Em Processo de Aprendizagem (0)</span>';
  h += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#F59E0B;margin-right:4px;"></span>Em Processo de Generalização (1)</span>';
  h += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#3B82F6;margin-right:4px;"></span>Interm. (2-3)</span>';
  h += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#10B981;margin-right:4px;"></span>Adquirido (4)</span>';
  h += '<span style="margin-left:auto;color:#64748B;">Selecione os itens que serão trabalhados no PEI</span></div>';

  doms.forEach(function(dom) {
    h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:12px;">';
    h += '<div style="font-size:12px;font-weight:700;color:#2563A8;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #F1F5F9;">'+esc(dom.nome)+'</div>';
    
    dom.itens.forEach(function(item) {
      var itemId  = item.item_id;
      var pts     = item.pontuacao || 0;
      var codigo  = item.protocolo_itens ? item.protocolo_itens.codigo : '';
      var desc    = item.protocolo_itens ? item.protocolo_itens.descricao : '';
      var descMeta = item.protocolo_itens ? (item.protocolo_itens.descricao_meta || item.protocolo_itens.instrucao || '') : '';
      
      // Cor e label da pontuação
      var cor, lbl;
      if (pts >= 4)      { cor='#10B981'; lbl='Adquirido'; }
      else if (pts >= 2) { cor='#3B82F6'; lbl='Intermediário'; }
      else if (pts === 1){ cor='#F59E0B'; lbl='Em Processo de Generalização'; }
      else               { cor='#EF4444'; lbl='Em Processo de Aprendizagem'; }

      // Sugerido automaticamente se pontuação < 2
      var sugerido = pts < 2;

      h += '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #F8FAFC;">';
      h += '<input type="checkbox" data-id="'+itemId+'" data-desc="'+esc(desc)+'" data-descmeta="'+esc(descMeta)+'"';
      h += ' data-domid="'+(item.dominio_id||'')+'" data-protid="'+(item.protocolo_id||'')+'"';
      h += ' data-pts="'+pts+'"';
      h += (sugerido ? ' checked' : '');
      h += ' onchange="toggleMeta(this)" style="margin-top:3px;width:15px;height:15px;accent-color:#2563A8;flex-shrink:0;">';
      
      h += '<div style="flex:1;min-width:0;">';
      h += '<div style="font-size:12px;font-weight:500;">'+esc(desc)+'</div>';
      if (descMeta) h += '<div style="font-size:11px;color:#64748B;margin-top:2px;">'+esc(descMeta.substring(0,120))+(descMeta.length>120?'...':'')+'</div>';
      h += '<div style="font-size:10.5px;color:#94A3B8;margin-top:2px;">'+esc(codigo)+'</div></div>';
      
      h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">';
      h += '<span style="font-size:10px;font-weight:600;color:'+cor+';background:'+cor+'18;padding:2px 7px;border-radius:10px;white-space:nowrap;">'+lbl+' ('+pts+')</span>';
      if (sugerido) h += '<span style="font-size:9px;color:#9333EA;font-weight:600;">★ Sugerido</span>';
      h += '</div></div>';

      // Inicializar metas sugeridas automaticamente
      if (sugerido) {
        PEI.metasSelecionadas[itemId] = _criarMeta(itemId, desc, descMeta, item.dominio_id, item.protocolo_id, pts);
      }
    });
    h += '</div>';
  });

  h += '<div style="text-align:right;margin-top:16px;display:flex;align-items:center;justify-content:flex-end;gap:12px;">';
  h += '<span id="peiContador" style="font-size:12px;color:#64748B;">'+Object.keys(PEI.metasSelecionadas).length+' metas selecionadas</span>';
  h += '<button class="btn bp" onclick="gerarPEI()"><i class="ti ti-arrow-right"></i> Gerar PEI</button></div>';
  h += '</div>';

  var div = document.createElement('div');
  div.innerHTML = h;
  container.appendChild(div.firstChild);
}

function _criarMeta(itemId, desc, descMeta, dominioId, protId, pts) {
  return {
    descricao:    desc,
    descricao_atividade: descMeta || '',
    dominio_id:   dominioId || null,
    protocolo_id: protId || null,
    momento:      'Acolhimento',
    prioridade:   pts === 0 ? 'alta' : pts === 1 ? 'media' : 'baixa',
    submetas:     ['','','','']
  };
}

function toggleMeta(cb) {
  var id = cb.dataset.id;
  if (cb.checked) {
    PEI.metasSelecionadas[id] = _criarMeta(
      id, cb.dataset.desc, cb.dataset.descmeta,
      cb.dataset.domid, cb.dataset.protid, parseInt(cb.dataset.pts||0)
    );
  } else {
    delete PEI.metasSelecionadas[id];
  }
  var count = Object.keys(PEI.metasSelecionadas).length;
  var el = document.getElementById('peiContador');
  if (el) el.textContent = count + (count===1?' meta selecionada':' metas selecionadas');
}

function gerarPEI() {
  var metas = Object.entries(PEI.metasSelecionadas);
  if (!metas.length) { alert('Selecione pelo menos uma meta.'); return; }

  var container = document.getElementById('v-avaliacoes');
  _limparViewsPEI();

  var pacNome   = PEI.paciente ? PEI.paciente.nome : '—';
  var pacNasc   = PEI.paciente && PEI.paciente.data_nascimento
    ? new Date(PEI.paciente.data_nascimento).toLocaleDateString('pt-BR') : '—';
  var today     = new Date().toLocaleDateString('pt-BR');
  var proxReav  = new Date();
  proxReav.setMonth(proxReav.getMonth() + 6);
  var proxReavStr = proxReav.toLocaleDateString('pt-BR');

  // Pegar logo
  var logoEl2 = document.querySelector('.sb-logo img, img[src^="data:image"]');
  var logoSrc2 = logoEl2 ? logoEl2.src : '';

  var h = '<div id="avPEIGeradoView" style="padding:20px;max-width:960px;margin:0 auto;">';
  // Logo no topo
  if (logoSrc2) {
    h += '<div style="text-align:center;margin-bottom:16px;padding-bottom:14px;border-bottom:2px solid #27386A;">';
    h += '<img src="'+logoSrc2+'" style="height:50px;object-fit:contain;">';
    h += '<div style="font-size:11px;color:#64748B;margin-top:4px;">Clínica Multidisciplinar do Neurodesenvolvimento</div>';
    h += '</div>';
  }
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">';
  h += '<button class="btn bo" onclick="mostrarSelecaoMetas()"><i class="ti ti-arrow-left"></i> Voltar</button>';
  h += '<div style="flex:1"><div style="font-size:16px;font-weight:700;">PEI — Plano de Ensino Individual</div>';
  h += '<div style="font-size:12px;color:#64748B;">Elaborado em '+today+'</div></div>';
  h += '</div>';

  // Identificação
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:14px;">';
  h += '<div style="font-size:12px;font-weight:700;color:#2563A8;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #EEF4FF;">Identificação</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">';
  h += '<div><div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;">Nome Completo</div>';
  h += '<div style="font-size:13px;font-weight:600;margin-top:3px;">'+esc(pacNome)+'</div></div>';
  h += '<div><div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;">Data de Nascimento</div>';
  h += '<div style="font-size:13px;font-weight:600;margin-top:3px;">'+esc(pacNasc)+'</div></div>';
  h += '<div><div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;">Próxima Reavaliação</div>';
  h += '<div style="font-size:13px;font-weight:600;margin-top:3px;color:#2563A8;">'+esc(proxReavStr)+'</div></div>';
  h += '</div>';
  h += '<div style="margin-top:12px;display:flex;align-items:center;gap:10px;">';
  h += '<label style="font-size:11px;font-weight:600;color:#374151;white-space:nowrap;">Tipo:</label>';
  h += '<select id="peiTipo" style="border:1.5px solid #2563A8;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:600;color:#2563A8;">';
  h += '<option value="inicial">Avaliação Inicial</option>';
  h += '<option value="reav1">Reavaliação 1</option>';
  h += '<option value="reav2">Reavaliação 2</option>';
  h += '<option value="reav3">Reavaliação 3</option>';
  h += '<option value="reav4">Reavaliação 4</option>';
  h += '</select>';
  h += '</div>';
  h += '</div>';

  // Objetivos gerais
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:14px;">';
  h += '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Objetivos Gerais do PEI</label>';
  h += '<textarea id="peiObjetivos" rows="3" style="width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:8px;font-size:12px;resize:vertical;box-sizing:border-box;" placeholder="Descreva os objetivos gerais deste plano..."></textarea>';
  h += '</div>';

  metas.forEach(function(entry, idx) {
    var itemId = entry[0];
    var meta   = entry[1];
    
    h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:14px;">';
    
    // Cabeçalho da meta
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
    h += '<div style="background:#2563A8;color:#fff;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;">META '+(idx+1)+'</div>';
    var priCor = meta.prioridade==='alta'?'#EF4444':meta.prioridade==='media'?'#F59E0B':'#10B981';
    h += '<select data-item="'+itemId+'" onchange="PEI.metasSelecionadas[this.dataset.item].prioridade=this.value;this.style.borderColor=this.value===\'alta\'?\'#EF4444\':this.value===\'media\'?\'#F59E0B\':\'#10B981\'" style="border:2px solid '+priCor+';border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;">';
    ['alta','media','baixa'].forEach(function(p){
      h += '<option value="'+p+'"'+(meta.prioridade===p?' selected':'')+'>'+p.charAt(0).toUpperCase()+p.slice(1)+' prioridade</option>';
    });
    h += '</select></div>';

    // Nome da meta (editável)
    h += '<div style="margin-bottom:8px;">';
    h += '<label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Meta</label>';
    h += '<input data-item="'+itemId+'" onchange="PEI.metasSelecionadas[this.dataset.item].descricao=this.value"';
    h += ' value="'+esc(meta.descricao)+'" style="width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:7px 10px;font-size:12px;font-weight:500;box-sizing:border-box;">';
    h += '</div>';

    // Descrição da atividade (editável)
    h += '<div style="margin-bottom:12px;">';
    h += '<label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Descrição da atividade</label>';
    h += '<textarea data-item="'+itemId+'" onchange="PEI.metasSelecionadas[this.dataset.item].descricao_atividade=this.value"';
    h += ' rows="2" style="width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:7px 10px;font-size:12px;resize:vertical;box-sizing:border-box;">'+esc(meta.descricao_atividade)+'</textarea>';
    h += '</div>';

    // Momento
    h += '<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;">';
    h += '<label style="font-size:11px;font-weight:600;color:#374151;white-space:nowrap;">Momento:</label>';
    h += '<select data-item="'+itemId+'" onchange="PEI.metasSelecionadas[this.dataset.item].momento=this.value" style="border:1px solid #E2E8F0;border-radius:6px;padding:5px 8px;font-size:12px;">';
    PEI.momentos.forEach(function(m){
      h += '<option value="'+m+'"'+(meta.momento===m?' selected':'')+'>'+m+'</option>';
    });
    h += '</select></div>';

    // 4 submetas editáveis
    h += '<div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;border-top:1px solid #F1F5F9;padding-top:10px;">';
    h += '<i class="ti ti-list-check" style="font-size:12px"></i> Submetas — 3 oportunidades cada</div>';
    
    for (var s = 0; s < 4; s++) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
      h += '<div style="background:#EEF4FF;color:#2563A8;border-radius:6px;padding:4px 8px;font-size:10.5px;font-weight:700;white-space:nowrap;min-width:70px;text-align:center;">SUBMETA '+(s+1)+'</div>';
      h += '<input data-item="'+itemId+'" data-sub="'+s+'" onchange="PEI.metasSelecionadas[this.dataset.item].submetas[parseInt(this.dataset.sub)]=this.value"';
      h += ' value="'+esc(meta.submetas[s]||'')+'"';
      h += ' placeholder="Descreva a submeta '+(s+1)+'..." style="flex:1;border:1px solid #E2E8F0;border-radius:6px;padding:6px 10px;font-size:12px;">';
      h += '<span style="font-size:10px;color:#94A3B8;white-space:nowrap;">× 3 oport.</span>';
      h += '</div>';
    }

    // Critério de domínio e tipo de dica
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid #F1F5F9;">';
    h += '<div><label style="font-size:10.5px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Critério de domínio</label>';
    h += '<input data-item="'+itemId+'" onchange="PEI.metasSelecionadas[this.dataset.item].criterio=this.value"';
    h += ' value="'+(meta.criterio||'80% em 3 sessões consecutivas')+'"';
    h += ' style="width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:5px 8px;font-size:11.5px;box-sizing:border-box;"></div>';
    h += '<div><label style="font-size:10.5px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Tipo de Dica (SD)</label>';
    h += '<select data-item="'+itemId+'" onchange="PEI.metasSelecionadas[this.dataset.item].tipo_dica=this.value" style="width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:5px 8px;font-size:11.5px;">';
    h += '<option value="verbal">Verbal</option>';
    h += '<option value="gestual">Gestual</option>';
    h += '<option value="fisica_parcial">Física Parcial</option>';
    h += '<option value="fisica_total">Física Total</option>';
    h += '<option value="modelo">Modelo</option>';
    h += '<option value="posicional">Posicional</option>';
    h += '</select></div>';
    h += '</div>';
    h += '</div>';
  });

  h += '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:16px;border-top:2px solid #E2E8F0;">';
  h += '<button class="btn bo" onclick="exportarPEIWord()"><i class="ti ti-file-type-doc"></i> Exportar Word</button>';
  h += '<button class="btn bo" onclick="exportarPEIPDF()"><i class="ti ti-printer"></i> Salvar PDF</button>';
  h += '<button class="btn bp" onclick="salvarPEI()" style="background:#27386A;"><i class="ti ti-check"></i> Finalizar e Salvar PEI</button>';
  h += '</div>';
  h += '</div>';

  var div = document.createElement('div');
  div.innerHTML = h;
  container.appendChild(div.firstChild);
}

function salvarPEI() {
  var metas = Object.entries(PEI.metasSelecionadas);
  if (!metas.length) { alert('Adicione pelo menos uma meta.'); return; }

  var objEl = document.getElementById('peiObjetivos');
  var objText = objEl ? objEl.value : '';
  var tipoEl = document.getElementById('peiTipo');
  var tipo = tipoEl ? tipoEl.value : 'inicial';
  var hoje = new Date().toISOString().split('T')[0];
  var pacNome = PEI.paciente ? PEI.paciente.nome : '';

  // Determinar se é criação ou atualização
  var peiIdExistente = PEI.peiId || null;

  function _salvarMetas(peiId) {
    // Deletar metas antigas do PEI (se existente)
    var deletarPromise = peiIdExistente
      ? getSB().from('pei_metas').delete().eq('pei_id', peiId)
      : Promise.resolve({error: null});

    deletarPromise.then(function() {
      var metasInsert = metas.map(function(entry) {
        var meta = entry[1];
        return {
          clinic_id:              APP.clinicId,
          patient_id:             PEI.avaliacao ? PEI.avaliacao.patient_id : null,
          avaliacao_id:           PEI.avaliacao ? (PEI.avaliacao.id || null) : null,
          item_id:                entry[0],
          dominio_id:             meta.dominio_id || null,
          protocolo_id:           meta.protocolo_id || null,
          descricao:              meta.descricao,
          justificativa:          meta.descricao_atividade || null,
          prioridade:             meta.prioridade || 'media',
          status:                 'ativa',
          data_inicio:            hoje,
          gerada_automaticamente: true
        };
      });

      getSB().from('metas').insert(metasInsert).select().then(function(rMetas) {
        if (rMetas.error) { alert('Erro ao salvar metas: ' + rMetas.error.message); return; }
        var metasSalvas = rMetas.data;

        var peiMetasInsert = metasSalvas.map(function(m, i) {
          return { clinic_id: APP.clinicId, pei_id: peiId, meta_id: m.id, ordem: i+1 };
        });

        getSB().from('pei_metas').insert(peiMetasInsert).then(function() {
          var submetasInsert = [];
          metas.forEach(function(entry, idx) {
            var meta = entry[1];
            var metaSalva = metasSalvas[idx];
            if (!metaSalva) return;
            (meta.submetas || []).forEach(function(sub, s) {
              if (!sub || !sub.trim()) return;
              submetasInsert.push({
                clinic_id:              APP.clinicId,
                patient_id:             PEI.avaliacao ? PEI.avaliacao.patient_id : null,
                meta_id:                metaSalva.id,
                descricao:              sub,
                ordem:                  s+1,
                nivel_ajuda:            'ajuda_total',
                criterio_tentativas:    3,
                status:                 'nao_iniciada',
                gerada_automaticamente: true
              });
            });
          });

          if (!submetasInsert.length) {
            toast('PEI salvo! ✓');
            PEI.peiId = null;
            setTimeout(function(){ abrirPEIPaciente(); }, 800);
            return;
          }

          getSB().from('submetas').insert(submetasInsert).then(function(rSub) {
            if (rSub.error) { alert('Erro nas submetas: ' + rSub.error.message); return; }
            toast('PEI salvo com sucesso! ✓');
            PEI.peiId = null;
            setTimeout(function(){ abrirPEIPaciente(); }, 800);
          });
        });
      });
    });
  }

  if (peiIdExistente) {
    // Atualizar PEI existente
    getSB().from('pei').update({
      titulo:           'PEI — ' + pacNome + ' — ' + tipo,
      objetivos_gerais: objText || null,
      atualizado:       new Date().toISOString()
    }).eq('id', peiIdExistente).then(function(r) {
      if (r.error) { alert('Erro ao atualizar PEI: ' + r.error.message); return; }
      _salvarMetas(peiIdExistente);
    });
  } else {
    // Criar novo PEI
    getSB().from('pei').insert({
      clinic_id:        APP.clinicId,
      patient_id:       PEI.avaliacao ? PEI.avaliacao.patient_id : null,
      avaliacao_id:     PEI.avaliacao ? (PEI.avaliacao.id || null) : null,
      titulo:           'PEI — ' + pacNome + ' — ' + tipo,
      data_elaboracao:  hoje,
      objetivos_gerais: objText || null,
      status:           'ativo',
      versao:           1,
      assinado:         false
    }).select().single().then(function(rPei) {
      if (rPei.error) { alert('Erro ao criar PEI: ' + rPei.error.message); return; }
      _salvarMetas(rPei.data.id);
    });
  }
}

function _limparViewsPEI() {
  ['avListaView','avAplicacaoView','avResultadosView','avPEIView','avPEIGeradoView','avRelatorioView'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { el.style.display='none'; try{el.remove();}catch(e){} }
  });
}


/* ═══════════════════════════════════════════════════
   MÓDULO RELATÓRIO DE AVALIAÇÃO
   ═══════════════════════════════════════════════════ */

var REL = {
  avaliacao: null,
  paciente: null,
  respostas: [],
  dominios: {}
};

function abrirRelatorio(avId) {
  getSB().from('avaliacoes')
    .select('*,protocolo_templates(nome,sigla),patients(nome,data_nascimento,diagnostico_cid,convenio)')
    .eq('id', avId).single()
    .then(function(r) {
      if (r.error || !r.data) { alert('Erro ao carregar avaliação.'); return; }
      REL.avaliacao = r.data;
      REL.paciente  = r.data.patients;

      getSB().from('avaliacao_respostas')
        .select('pontuacao,dominio_id,item_id,protocolo_dominios(nome,ordem),protocolo_itens(codigo,descricao,pontuacao_max)')
        .eq('avaliacao_id', avId)
        .then(function(rr) {
          REL.respostas = rr.data || [];
          mostrarRelatorio();
        });
    });
}

function mostrarRelatorio() {
  nav('avaliacoes');
  var container = document.getElementById('v-avaliacoes');
  _limparViewsRel();

  var av  = REL.avaliacao;
  var pac = REL.paciente;
  var pacNome = pac ? pac.nome : '—';
  var protNome = av.protocolo_templates ? av.protocolo_templates.nome : '—';
  var protSigla = av.protocolo_templates ? av.protocolo_templates.sigla : '—';
  var dtAv = av.data_aplicacao ? new Date(av.data_aplicacao).toLocaleDateString('pt-BR') : '—';
  var dtNasc = pac && pac.data_nascimento ? new Date(pac.data_nascimento).toLocaleDateString('pt-BR') : '—';
  var cid = pac && pac.diagnostico_cid ? (Array.isArray(pac.diagnostico_cid) ? pac.diagnostico_cid.join(', ') : pac.diagnostico_cid) : '—';

  // Calcular totais
  var total    = REL.respostas.length;
  var adquirido = REL.respostas.filter(function(r){return r.pontuacao>=4;}).length;
  var emergente = REL.respostas.filter(function(r){return r.pontuacao>=2&&r.pontuacao<4;}).length;
  var naoAdq    = REL.respostas.filter(function(r){return r.pontuacao<2;}).length;
  var pctAdq    = total ? Math.round(adquirido/total*100) : 0;

  // Agrupar por domínio
  var doms = {};
  REL.respostas.forEach(function(r) {
    var nome = r.protocolo_dominios ? r.protocolo_dominios.nome : 'Sem domínio';
    var ord  = r.protocolo_dominios ? r.protocolo_dominios.ordem : 99;
    if (!doms[nome]) doms[nome] = {nome:nome, ordem:ord, adq:0, emg:0, nao:0, total:0, itens:[]};
    doms[nome].total++;
    if (r.pontuacao>=4) doms[nome].adq++;
    else if (r.pontuacao>=2) doms[nome].emg++;
    else doms[nome].nao++;
    doms[nome].itens.push(r);
  });
  var domList = Object.values(doms).sort(function(a,b){return a.ordem-b.ordem;});

  var h = '<div id="avRelatorioView" style="padding:20px;max-width:960px;margin:0 auto;">';

  // Barra topo
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">';
  h += '<button class="btn bo" onclick="abrirResultados(\''+av.id+'\')"><i class="ti ti-arrow-left"></i> Voltar</button>';
  h += '<div style="flex:1"><div style="font-size:16px;font-weight:700;">Relatório de Avaliação</div>';
  h += '<div style="font-size:12px;color:#64748B;">'+esc(pacNome)+' · '+esc(protSigla)+' · '+dtAv+'</div></div>';
  h += '<button class="btn bo" onclick="exportarPEIPDF()"><i class="ti ti-printer"></i> Imprimir</button>';
  h += '</div>';

  // Cabeçalho do relatório
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin-bottom:14px;">';
  h += '<div style="font-size:14px;font-weight:700;color:#2563A8;margin-bottom:14px;border-bottom:2px solid #EEF4FF;padding-bottom:10px;">Identificação</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
  var campos = [
    ['Paciente', pacNome],
    ['Data de Nascimento', dtNasc],
    ['Diagnóstico (CID)', cid],
    ['Convênio', pac&&pac.convenio ? pac.convenio : '—'],
    ['Protocolo Aplicado', protNome],
    ['Data da Avaliação', dtAv]
  ];
  campos.forEach(function(c) {
    h += '<div><div style="font-size:10.5px;color:#94A3B8;font-weight:500;text-transform:uppercase;letter-spacing:.5px;">'+c[0]+'</div>';
    h += '<div style="font-size:13px;font-weight:500;margin-top:2px;">'+esc(c[1])+'</div></div>';
  });
  h += '</div></div>';

  // Cards de resumo
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;">';
  [{l:'Total avaliado',v:total,c:'#2563A8',bg:'#EEF4FF'},
   {l:'Adquiridos',v:adquirido,c:'#10B981',bg:'#F0FDF4'},
   {l:'Em Processo de Generalizaçãos',v:emergente,c:'#F59E0B',bg:'#FFFBEB'},
   {l:'Não adquiridos',v:naoAdq,c:'#EF4444',bg:'#FEF2F2'}
  ].forEach(function(card) {
    h += '<div style="background:'+card.bg+';border-radius:10px;padding:14px;text-align:center;">';
    h += '<div style="font-size:26px;font-weight:700;color:'+card.c+'">'+card.v+'</div>';
    h += '<div style="font-size:11px;color:#64748B;margin-top:3px;">'+card.l+'</div></div>';
  });
  h += '</div>';

  // Gráfico de desempenho por domínio
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:14px;">';
  h += '<div style="font-size:13px;font-weight:700;margin-bottom:14px;">Desempenho por Domínio</div>';
  domList.forEach(function(dom) {
    if (!dom.total) return;
    var pAdq = Math.round(dom.adq/dom.total*100);
    var pEmg = Math.round(dom.emg/dom.total*100);
    var pNao = Math.round(dom.nao/dom.total*100);
    h += '<div style="margin-bottom:11px;">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:3px;">';
    h += '<span style="font-size:11.5px;font-weight:500;">'+esc(dom.nome)+'</span>';
    h += '<span style="font-size:10.5px;color:#64748B;">'+dom.adq+'/'+dom.total+' ('+pAdq+'%)</span></div>';
    h += '<div style="height:10px;border-radius:5px;overflow:hidden;display:flex;background:#F1F5F9;">';
    if (pAdq>0) h += '<div style="width:'+pAdq+'%;background:#10B981;" title="Adquirido"></div>';
    if (pEmg>0) h += '<div style="width:'+pEmg+'%;background:#F59E0B;" title="Em Processo de Generalização"></div>';
    if (pNao>0) h += '<div style="width:'+pNao+'%;background:#FCA5A5;" title="Não adquirido"></div>';
    h += '</div></div>';
  });
  h += '<div style="display:flex;gap:14px;margin-top:10px;">';
  [['#10B981','Adquirido'],['#F59E0B','Em Processo de Generalização'],['#FCA5A5','Não adquirido']].forEach(function(l){
    h += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748B;">';
    h += '<div style="width:10px;height:10px;border-radius:2px;background:'+l[0]+'"></div>'+l[1]+'</div>';
  });
  h += '</div></div>';

  // Campos editáveis pelo coordenador
  var secoes = [
    {id:'relHistorico', label:'Histórico do Paciente', placeholder:'Descreva o histórico clínico relevante, desenvolvimento, tratamentos anteriores...'},
    {id:'relObservacoes', label:'Observações Clínicas', placeholder:'Registre as observações feitas durante as sessões de avaliação...'},
    {id:'relPontosForts', label:'Pontos Fortes Identificados', placeholder:'Descreva as habilidades e competências já adquiridas...'},
    {id:'relAreasPrior', label:'Áreas Prioritárias para Intervenção', placeholder:'Identifique as áreas que precisam de maior foco terapêutico...'},
    {id:'relRecomendacoes', label:'Recomendações', placeholder:'Recomendações para família, escola e equipe multidisciplinar...'},
    {id:'relConclusao', label:'Conclusão', placeholder:'Conclusão geral da avaliação e próximos passos...'}
  ];
  secoes.forEach(function(sec) {
    h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:12px;">';
    h += '<label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:8px;">'+sec.label+'</label>';
    h += '<textarea id="'+sec.id+'" rows="4" style="width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:9px;font-size:12px;resize:vertical;box-sizing:border-box;line-height:1.6;" placeholder="'+sec.placeholder+'"></textarea>';
    h += '</div>';
  });

  // Assinatura
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:14px;">';
  h += '<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:12px;">Responsável pelo Relatório</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
  h += '<div><label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;">Nome do Coordenador</label>';
  h += '<input id="relCoordenador" style="width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:7px;font-size:12px;box-sizing:border-box;" placeholder="Nome completo"></div>';
  h += '<div><label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;">Conselho / Registro</label>';
  h += '<input id="relConselho" style="width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:7px;font-size:12px;box-sizing:border-box;" placeholder="Ex: CRP 06/12345"></div>';
  h += '</div></div>';

  // Botão salvar
  h += '<div style="text-align:right;margin-top:8px;display:flex;gap:10px;justify-content:flex-end;">';
  h += '<button class="btn bo" onclick="exportarPEIPDF()"><i class="ti ti-printer"></i> Imprimir</button>';
  h += '<button class="btn bp" data-avid="'+av.id+'" onclick="salvarRelatorio(this.dataset.avid)"><i class="ti ti-device-floppy"></i> Salvar Relatório</button>';
  h += '</div></div>';

  _limparViewsRel();
  var div = document.createElement('div');
  div.innerHTML = h;
  container.appendChild(div.firstChild);
}

function salvarRelatorio(avId) {
  var campos = {
    historico:       document.getElementById('relHistorico')    ? document.getElementById('relHistorico').value    : '',
    observacoes:     document.getElementById('relObservacoes')   ? document.getElementById('relObservacoes').value   : '',
    pontos_fortes:   document.getElementById('relPontosForts')   ? document.getElementById('relPontosForts').value   : '',
    areas_priorit:   document.getElementById('relAreasPrior')    ? document.getElementById('relAreasPrior').value    : '',
    recomendacoes:   document.getElementById('relRecomendacoes') ? document.getElementById('relRecomendacoes').value : '',
    conclusao:       document.getElementById('relConclusao')     ? document.getElementById('relConclusao').value     : '',
    coordenador:     document.getElementById('relCoordenador')   ? document.getElementById('relCoordenador').value   : '',
    conselho:        document.getElementById('relConselho')      ? document.getElementById('relConselho').value      : ''
  };

  // Salvar nas observações gerais da avaliação
  var texto = JSON.stringify(campos);
  getSB().from('avaliacoes')
    .update({observacoes_gerais: texto})
    .eq('id', avId)
    .then(function(r) {
      if (r.error) { alert('Erro ao salvar: ' + r.error.message); return; }
      toast('Relatório salvo! ✓');
    });
}

function _limparViewsRel() {
  ['avListaView','avAplicacaoView','avResultadosView','avPEIView','avPEIGeradoView','avRelatorioView'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { el.style.display='none'; try{el.remove();}catch(e){} }
  });
}



/* ═══════════════════════════════════════════════════
   MÓDULO FOLHA DE REGISTRO
   ═══════════════════════════════════════════════════ */

var FR = {
  paciente:   null,
  pei:        null,
  metas:      [],
  sessao:     null,
  metaAtual:  null,
  submetaAtual: null,
  oportunidades: {},  // submeta_id -> {num -> classificacao}
};

var FR_CATEGORIAS = [
  {id:'independente',        label:'Independente',     cor:'#10B981'},
  {id:'dica_verbal',         label:'Dica Verbal',      cor:'#3B82F6'},
  {id:'dica_gestual',        label:'Dica Gestual',     cor:'#8B5CF6'},
  {id:'dica_total',          label:'Dica Total',       cor:'#F59E0B'},
  {id:'nao_respondeu',       label:'Não Respondeu',    cor:'#EF4444'},
  {id:'sem_oportunidade',    label:'Sem Oportunidade', cor:'#94A3B8'}
];

/* ─── Abrir via ficha do paciente ─── */
function abrirFolhaRegistroPaciente(pacId) {
  // Buscar paciente
  getSB().from('patients').select('*').eq('id', pacId).single()
    .then(function(r) {
      if (r.error || !r.data) return;
      FR.paciente = r.data;
      _carregarMetasRegistro();
    });
}

function abrirFolhaRegistro() {
  if (!PAC && !FR.paciente) {
    nav('pacientes');
    toast('Selecione um paciente primeiro');
    return;
  }
  if (PAC && PAC.atual && !FR.paciente) {
    FR.paciente = PAC.atual;
  }
  if (FR.paciente) {
    _carregarMetasRegistro();
  } else {
    nav('registro');
  }
}

function _carregarMetasRegistro() {
  nav('registro');
  var subEl = document.getElementById('frSubt');
  if (subEl) subEl.textContent = FR.paciente.nome;
  var btnNova = document.getElementById('btnNovaSessao');
  if (btnNova) btnNova.style.display = '';

  // Buscar metas ativas do paciente com submetas
  getSB().from('metas')
    .select('id,descricao,justificativa,prioridade,status,submetas(id,descricao,ordem,status,criterio_tentativas,criterio_percentual,criterio_sessoes)')
    .eq('patient_id', FR.paciente.id)
    .eq('clinic_id', APP.clinicId)
    .eq('status', 'ativo')
    .order('criado_em')
    .then(function(r) {
      FR.metas = r.data || [];
      _renderizarListaMetas();
    });
}

function _renderizarListaMetas() {
  var el = document.getElementById('frConteudo');
  if (!el) return;

  if (!FR.metas.length) {
    el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:40px;font-size:13px;">Nenhuma meta ativa para este paciente.<br>Crie o PEI primeiro na aba Avaliações.</div>';
    return;
  }

  var h = '<div style="padding:16px;max-width:900px;margin:0 auto;">';

  // Cabeçalho paciente
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">';
  h += '<div style="width:38px;height:38px;border-radius:50%;background:#2563A8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">'+iniciais(FR.paciente.nome)+'</div>';
  h += '<div style="flex:1"><div style="font-size:14px;font-weight:600;">'+esc(FR.paciente.nome)+'</div>';
  h += '<div style="font-size:11px;color:#64748B;">'+FR.metas.length+' metas ativas</div></div>';
  h += '<button class="btn bp" onclick="iniciarNovaSessao()"><i class="ti ti-plus"></i> Nova Sessão</button>';
  h += '</div>';

  // Lista de metas
  FR.metas.forEach(function(meta, mi) {
    var submetas = (meta.submetas || []).sort(function(a,b){return a.ordem-b.ordem;});
    var subEmTreino = submetas.find(function(s){return s.status==='ativo'||s.status==='em_treino';});

    h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:12px;">';

    // Cabeçalho da meta
    h += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">';
    h += '<div style="background:#2563A8;color:#fff;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;white-space:nowrap;">META '+(mi+1)+'</div>';
    h += '<div style="flex:1"><div style="font-size:13px;font-weight:600;">'+esc(meta.descricao)+'</div>';
    if (meta.justificativa) h += '<div style="font-size:11px;color:#64748B;margin-top:3px;">'+esc(meta.justificativa)+'</div>';
    h += '</div></div>';

    // Submetas
    submetas.forEach(function(sub, si) {
      var emTreino = sub.id === (subEmTreino && subEmTreino.id);
      var cor = emTreino ? '#2563A8' : '#94A3B8';
      var bgLabel = emTreino ? '#EEF4FF' : '#F8FAFC';
      var statusLabel = emTreino ? 'EM TREINO' : (sub.status==='dominada'?'DOMINADA':'EM ESPERA');

      h += '<div style="border:1px solid '+(emTreino?'#2563A8':'#E2E8F0')+';border-radius:9px;padding:12px;margin-bottom:8px;'+(emTreino?'background:#F8FBFF':'')+'">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:'+(emTreino?'10':'4')+'px;">';
      h += '<span style="font-size:10px;font-weight:700;color:'+cor+';background:'+bgLabel+';padding:2px 8px;border-radius:10px;">'+statusLabel+'</span>';
      h += '<span style="font-size:12px;font-weight:'+(emTreino?'600':'400')+';color:'+(emTreino?'#1e3a5f':'#64748B')+';">S'+(si+1)+'. '+esc(sub.descricao)+'</span>';
      h += '</div>';

      // Se em treino, mostrar botão de registrar
      if (emTreino) {
        var nOport = sub.criterio_tentativas || 3;
        h += '<div style="display:flex;align-items:center;justify-content:space-between;">';
        h += '<div style="font-size:11px;color:#64748B;">';
        h += (sub.criterio_percentual||80)+'% em '+(sub.criterio_sessoes||3)+' sessões · '+nOport+' oportunidades</div>';
        h += '<button class="btn bp" style="font-size:11px;" data-metaid="'+meta.id+'" data-subid="'+sub.id+'" data-noport="'+nOport+'" onclick="abrirRegistroSessao(this.dataset.metaid,this.dataset.subid,parseInt(this.dataset.noport))">'+
          '<i class="ti ti-edit"></i> Registrar Sessão</button>';
        h += '</div>';
      }
      h += '</div>';
    });

    h += '</div>';
  });

  h += '</div>';
  el.innerHTML = h;
}

/* ─── Tela de registro de sessão ─── */
function abrirRegistroSessao(metaId, submetaId, nOport) {
  FR.metaAtual    = FR.metas.find(function(m){return m.id===metaId;});
  FR.submetaAtual = FR.metaAtual && FR.metaAtual.submetas
    ? FR.metaAtual.submetas.find(function(s){return s.id===submetaId;})
    : null;

  if (!FR.metaAtual || !FR.submetaAtual) return;
  FR.oportunidades[submetaId] = {};

  var el = document.getElementById('frConteudo');
  var hoje = new Date().toLocaleDateString('pt-BR');
  var meta = FR.metaAtual;
  var sub  = FR.submetaAtual;

  var h = '<div style="padding:12px;max-width:600px;margin:0 auto;">';

  // Navegação
  h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
  h += '<button class="btn bo" onclick="_renderizarListaMetas()"><i class="ti ti-arrow-left"></i> Voltar</button>';
  h += '<div style="flex:1"><div style="font-size:15px;font-weight:700;">Registrar Sessão</div>';
  h += '<div style="font-size:11px;color:#64748B;">'+esc(FR.paciente.nome)+' · '+hoje+'</div></div>';
  h += '<button class="btn bp" onclick="finalizarSessao(\''+metaId+'\',\''+submetaId+'\','+nOport+')"><i class="ti ti-check"></i> Finalizar</button>';
  h += '</div>';

  // Info da meta
  h += '<div style="background:#EEF4FF;border-radius:10px;padding:12px 14px;margin-bottom:14px;">';
  h += '<div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Meta</div>';
  h += '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">'+esc(meta.descricao)+'</div>';
  h += '<div style="font-size:11px;color:#64748B;margin-bottom:8px;">'+esc(sub.descricao)+'</div>';
  h += '<div style="font-size:10.5px;color:#2563A8;font-weight:500;">';
  h += 'Critério: '+(sub.criterio_percentual||80)+'% em '+(sub.criterio_sessoes||3)+' sessões consecutivas</div>';
  h += '</div>';

  // Observação da sessão
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:12px;margin-bottom:14px;">';
  h += '<label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Observação da sessão (opcional)</label>';
  h += '<textarea id="frObservacao" rows="2" style="width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:7px;font-size:12px;resize:vertical;box-sizing:border-box;" placeholder="Contexto do atendimento, comportamentos observados..."></textarea>';
  h += '</div>';

  // Matriz de oportunidades
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:14px;">';
  h += '<div style="padding:12px 16px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;">';
  h += '<div style="font-size:12px;font-weight:700;">Oportunidades de Resposta</div>';
  h += '<div id="frResultadoLive" style="font-size:12px;font-weight:600;color:#2563A8;">—</div>';
  h += '</div>';

  // Desktop: tabela
  h += '<div class="fr-tabela-desktop">';
  h += '<table style="width:100%;border-collapse:collapse;">';
  h += '<thead><tr style="background:#F8FAFC;">';
  h += '<th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#64748B;font-weight:600;border-bottom:1px solid #E2E8F0;">Oportunidade</th>';
  FR_CATEGORIAS.forEach(function(cat) {
    h += '<th style="padding:8px 6px;text-align:center;font-size:10px;color:#64748B;font-weight:600;border-bottom:1px solid #E2E8F0;white-space:nowrap;">'+cat.label+'</th>';
  });
  h += '</tr></thead><tbody>';

  for (var i = 1; i <= nOport; i++) {
    h += '<tr style="border-bottom:1px solid #F1F5F9;" id="frRow-'+submetaId+'-'+i+'">';
    h += '<td style="padding:10px 12px;font-size:12px;font-weight:500;color:#374151;">'+i+'</td>';
    FR_CATEGORIAS.forEach(function(cat) {
      h += '<td style="padding:10px 6px;text-align:center;">';
      h += '<input type="radio" name="fr-'+submetaId+'-'+i+'" value="'+cat.id+'"';
      h += ' data-sub="'+submetaId+'" data-num="'+i+'" data-nOport="'+nOport+'"';
      h += ' onchange="registrarOportunidade(this)"';
      h += ' style="width:16px;height:16px;accent-color:'+cat.cor+';cursor:pointer;">';
      h += '</td>';
    });
    h += '</tr>';
  }
  h += '</tbody></table></div>';

  // Mobile: cards
  h += '<div class="fr-cards-mobile" style="display:none;padding:12px;">';
  for (var j = 1; j <= nOport; j++) {
    h += '<div style="border:1px solid #E2E8F0;border-radius:8px;padding:12px;margin-bottom:10px;">';
    h += '<div style="font-size:11.5px;font-weight:700;color:#2563A8;margin-bottom:10px;">OPORTUNIDADE '+j+'</div>';
    FR_CATEGORIAS.forEach(function(cat) {
      h += '<label style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #F8FAFC;cursor:pointer;">';
      h += '<input type="radio" name="fr-'+submetaId+'-'+j+'" value="'+cat.id+'"';
      h += ' data-sub="'+submetaId+'" data-num="'+j+'" data-nOport="'+nOport+'"';
      h += ' onchange="registrarOportunidade(this)"';
      h += ' style="width:15px;height:15px;accent-color:'+cat.cor+'">';
      h += '<span style="font-size:12px;">'+cat.label+'</span>';
      h += '</label>';
    });
    h += '</div>';
  }
  h += '</div>';
  h += '</div>';

  // Botão finalizar
  h += '<div style="text-align:right;">';
  h += '<button class="btn bp" onclick="finalizarSessao(\''+metaId+'\',\''+submetaId+'\','+nOport+')"><i class="ti ti-check"></i> Finalizar e Salvar</button>';
  h += '</div></div>';

  el.innerHTML = h;

  // Responsivo: mostrar cards em mobile
  if (window.innerWidth < 640) {
    var tabela = document.querySelector('.fr-tabela-desktop');
    var cards  = document.querySelector('.fr-cards-mobile');
    if (tabela) tabela.style.display = 'none';
    if (cards)  cards.style.display  = 'block';
  }
}

/* ─── Registrar oportunidade e calcular ─── */
function registrarOportunidade(radio) {
  var subId  = radio.dataset.sub;
  var num    = parseInt(radio.dataset.num);
  var nOport = parseInt(radio.dataset.nOport);
  var val    = radio.value;

  if (!FR.oportunidades[subId]) FR.oportunidades[subId] = {};
  FR.oportunidades[subId][num] = val;

  // Highlight da linha
  var row = document.getElementById('frRow-'+subId+'-'+num);
  if (row) row.style.background = val==='sem_oportunidade'?'#F8FAFC':'#F0FDF4';

  // Calcular resultado ao vivo
  _calcularResultadoLive(subId, nOport);
}

function _calcularResultadoLive(subId, nOport) {
  var resps  = FR.oportunidades[subId] || {};
  var indep  = 0, semOport = 0, total = 0;

  for (var n = 1; n <= nOport; n++) {
    if (resps[n]) {
      total++;
      if (resps[n] === 'independente')    indep++;
      if (resps[n] === 'sem_oportunidade') semOport++;
    }
  }

  var validas = total - semOport;
  var pct = validas > 0 ? Math.round(indep/validas*100) : null;

  var el = document.getElementById('frResultadoLive');
  if (el) {
    if (pct !== null) {
      var cor = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
      el.innerHTML = '<span style="color:'+cor+'">'+pct+'% independência</span> ('+total+'/'+nOport+' registradas)';
    } else {
      el.textContent = total+'/'+nOport+' registradas';
    }
  }
}

/* ─── Finalizar e salvar sessão ─── */
function finalizarSessao(metaId, submetaId, nOport) {
  var resps = FR.oportunidades[submetaId] || {};
  var registradas = Object.keys(resps).length;

  if (registradas < nOport) {
    if (!confirm('Ainda há '+(nOport-registradas)+' oportunidade(s) sem registro. Finalizar mesmo assim?')) return;
  }

  var obsEl = document.getElementById('frObservacao');
  var obs   = obsEl ? obsEl.value : '';
  var hoje  = new Date().toISOString().split('T')[0];

  // Calcular resultado
  var indep=0, dicaV=0, dicaG=0, dicaT=0, naoResp=0, semOport=0;
  for (var n in resps) {
    switch(resps[n]) {
      case 'independente':     indep++;    break;
      case 'dica_verbal':      dicaV++;    break;
      case 'dica_gestual':     dicaG++;    break;
      case 'dica_total':       dicaT++;    break;
      case 'nao_respondeu':    naoResp++;  break;
      case 'sem_oportunidade': semOport++; break;
    }
  }
  var total   = registradas;
  var validas = total - semOport;
  var pct     = validas > 0 ? Math.round(indep/validas*1000)/10 : null;

  // 1. Criar sessão
  getSB().from('sessoes_registro').insert({
    clinic_id:       APP.clinicId,
    patient_id:      FR.paciente.id,
    profissional_id: APP.user ? APP.user.id : null,
    data_sessao:     hoje,
    observacao_geral: obs || null,
    status:          'finalizada'
  }).select().single().then(function(rSessao) {
    if (rSessao.error) { alert('Erro ao criar sessão: '+rSessao.error.message); return; }
    var sessaoId = rSessao.data.id;

    // 2. Inserir oportunidades
    var ops = [];
    for (var num in resps) {
      ops.push({
        clinic_id:          APP.clinicId,
        sessao_id:          sessaoId,
        patient_id:         FR.paciente.id,
        meta_id:            metaId,
        submeta_id:         submetaId,
        submeta_versao:     1,
        numero_oportunidade: parseInt(num),
        classificacao:      resps[num],
        registrado_por:     APP.user ? APP.user.id : null
      });
    }

    getSB().from('registro_oportunidades').insert(ops).then(function() {

      // 3. Salvar resultado
      getSB().from('resultados_sessao').insert({
        clinic_id:               APP.clinicId,
        sessao_id:               sessaoId,
        meta_id:                 metaId,
        submeta_id:              submetaId,
        data_sessao:             hoje,
        total_oportunidades:     nOport,
        independente:            indep,
        dica_verbal:             dicaV,
        dica_gestual:            dicaG,
        dica_total:              dicaT,
        nao_respondeu:           naoResp,
        sem_oportunidade:        semOport,
        oportunidades_validas:   validas,
        percentual_independencia: pct,
        observacao:              obs || null
      }).then(function() {
        toast('Sessão salva! '+( pct!==null ? pct+'% independência' : 'sem dados válidos' )+' ✓');

        // Verificar critério de domínio
        _verificarCriterio(metaId, submetaId);
      });
    });
  });
}

/* ─── Verificar critério de domínio ─── */
function _verificarCriterio(metaId, submetaId) {
  var sub = FR.submetaAtual;
  if (!sub) { _renderizarListaMetas(); return; }

  var criterioSessoes = sub.criterio_sessoes || 3;
  var criterioPct     = sub.criterio_percentual || 80;

  // Buscar últimas sessões desta submeta
  getSB().from('resultados_sessao')
    .select('percentual_independencia,data_sessao')
    .eq('submeta_id', submetaId)
    .eq('clinic_id', APP.clinicId)
    .not('percentual_independencia', 'is', null)
    .order('data_sessao', {ascending:false})
    .limit(criterioSessoes)
    .then(function(r) {
      var resultados = r.data || [];
      var alcancado = resultados.length >= criterioSessoes &&
        resultados.every(function(res){ return res.percentual_independencia >= criterioPct; });

      if (alcancado) {
        if (confirm('🎉 Critério de domínio alcançado!\n\n'+
          criterioPct+'% em '+criterioSessoes+' sessões consecutivas.\n\n'+
          'Deseja marcar esta submeta como DOMINADA e avançar para a próxima?')) {
          _avancarSubmeta(metaId, submetaId);
          return;
        }
      }
      _renderizarListaMetas();
    });
}

/* ─── Avançar submeta ─── */
function _avancarSubmeta(metaId, submetaId) {
  var meta    = FR.metas.find(function(m){return m.id===metaId;});
  if (!meta) { _renderizarListaMetas(); return; }
  var submetas = (meta.submetas||[]).sort(function(a,b){return a.ordem-b.ordem;});
  var idxAtual = submetas.findIndex(function(s){return s.id===submetaId;});
  var proxima  = submetas[idxAtual+1];

  // Marcar atual como dominada
  getSB().from('submetas').update({status:'dominada', data_aquisicao: new Date().toISOString().split('T')[0]})
    .eq('id', submetaId).then(function() {
      if (proxima) {
        getSB().from('submetas').update({status:'ativo'}).eq('id', proxima.id).then(function() {
          toast('Submeta dominada! Avançando para S'+(idxAtual+2)+'. ✓');
          _carregarMetasRegistro();
        });
      } else {
        toast('Todas as submetas desta meta foram dominadas! ✓');
        _carregarMetasRegistro();
      }
    });
}

/* ─── Abrir via ficha do paciente ─── */
function iniciarNovaSessao() {
  if (FR.paciente) _renderizarListaMetas();
}


function abrirPEIPaciente() {
  if (!PAC.atual) { alert('Abra um paciente primeiro.'); return; }
  
  getSB().from('pei')
    .select('id,titulo,data_elaboracao,status,versao,avaliacao_id')
    .eq('patient_id', PAC.atual.id)
    .eq('clinic_id', APP.clinicId)
    .order('data_elaboracao', {ascending: false})
    .then(function(r) {
      var peis = r.data || [];
      if (peis.length > 0) {
        _mostrarListaPEIs(peis);
      } else {
        nav('avaliacoes');
        _limparViewsPEI();
        var container = document.getElementById('v-avaliacoes');
        var div = document.createElement('div');
        div.id = 'avPEISemPEIView';
        div.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
          '<i class="ti ti-target" style="font-size:48px;color:#27386A;display:block;margin-bottom:16px;"></i>' +
          '<div style="font-size:16px;font-weight:700;margin-bottom:8px;">Nenhum PEI encontrado</div>' +
          '<div style="font-size:13px;color:#64748B;max-width:400px;margin:0 auto 24px;">Para gerar o PEI, finalize uma avaliação primeiro.</div>' +
          '<button class="btn bp" onclick="abrirModuloAvaliacao()"><i class="ti ti-clipboard-check"></i> Ir para Avaliações</button>' +
          '</div>';
        container.appendChild(div);
      }
    });
}

function _mostrarListaPEIs(peis) {
  nav('avaliacoes');
  var container = document.getElementById('v-avaliacoes');
  _limparViewsPEI();
  var existing = document.getElementById('avPEIListaView');
  if (existing) existing.remove();

  var pacNome = PAC.atual ? PAC.atual.nome : '—';
  var h = '<div id="avPEIListaView" style="padding:20px;max-width:900px;margin:0 auto;">';
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">';
  h += '<button class="btn bo" onclick="nav(this.dataset.v)" data-v="paciente-ficha"><i class="ti ti-arrow-left"></i> Voltar</button>';
  h += '<div style="flex:1"><div style="font-size:16px;font-weight:700;">Planos de Ensino Individual</div>';
  h += '<div style="font-size:12px;color:#64748B;">'+esc(pacNome)+'</div></div>';
  h += '</div>';
  peis.forEach(function(pei) {
    var dt = pei.data_elaboracao ? new Date(pei.data_elaboracao).toLocaleDateString('pt-BR') : '—';
    h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">';
    h += '<div style="width:40px;height:40px;border-radius:8px;background:#EEF4FF;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#27386A;flex-shrink:0;">PEI</div>';
    h += '<div style="flex:1;cursor:pointer;" onclick="carregarPEIExistente(\''+pei.id+'\')"><div style="font-size:13px;font-weight:600;">'+esc(pei.titulo||'PEI')+'</div>';
    h += '<div style="font-size:11px;color:#64748B;">'+dt+' · Versão '+(pei.versao||1)+'</div></div>';
    h += '<div style="position:relative;"><button onclick="toggleMenuPEI(this)" style="background:none;border:none;cursor:pointer;padding:4px 10px;border-radius:6px;color:#64748B;font-size:18px;">···</button>';
    h += '<div class="menu-pei" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:100;min-width:140px;">';
    h += '<div onclick="carregarPEIExistente(\''+pei.id+'\')" style="padding:10px 14px;cursor:pointer;font-size:12px;display:flex;gap:8px;"><i class="ti ti-edit"></i> Abrir / Editar</div>';
    h += '<div onclick="excluirPEI(\''+pei.id+'\')" style="padding:10px 14px;cursor:pointer;font-size:12px;color:#EF4444;display:flex;gap:8px;"><i class="ti ti-trash"></i> Excluir</div>';
    h += '</div></div></div>'
  });
  h += '</div>';
  var div = document.createElement('div');
  div.innerHTML = h;
  container.appendChild(div.firstChild);
}

function carregarPEIExistente(peiId) {
  getSB().from('pei').select('*,patients(nome,data_nascimento)')
    .eq('id', peiId).single()
    .then(function(rPei) {
      if (rPei.error||!rPei.data) return;
      getSB().from('pei_metas')
        .select('meta_id,ordem,metas(id,descricao,justificativa,prioridade,submetas(id,descricao,ordem))')
        .eq('pei_id', peiId).order('ordem')
        .then(function(rMetas) {
          PEI.paciente = rPei.data.patients;
          PEI.avaliacao = {id:rPei.data.avaliacao_id, patient_id:rPei.data.patient_id};
          PEI.metasSelecionadas = {};
          (rMetas.data||[]).forEach(function(pm) {
            if (!pm.metas) return;
            var meta = pm.metas;
            var subs = (meta.submetas||[]).sort(function(a,b){return a.ordem-b.ordem;});
            PEI.metasSelecionadas[meta.id] = {
              descricao: meta.descricao,
              descricao_atividade: meta.justificativa||'',
              prioridade: meta.prioridade||'media',
              momento: 'Acolhimento',
              submetas: [subs[0]?subs[0].descricao:'', subs[1]?subs[1].descricao:'', subs[2]?subs[2].descricao:'', subs[3]?subs[3].descricao:''],
              criterio: '80% em 3 sessões consecutivas',
              tipo_dica: 'verbal'
            };
          });
          gerarPEI();
        });
    });
}


function toggleMenuPEI(btn) {
  var menu = btn.nextElementSibling;
  document.querySelectorAll('.menu-pei').forEach(function(m) {
    if (m !== menu) m.style.display = 'none';
  });
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  setTimeout(function() {
    document.addEventListener('click', function fechar(e) {
      if (!btn.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', fechar);
      }
    });
  }, 10);
}

function excluirPEI(peiId) {
  if (!confirm('Excluir este PEI? Esta ação não pode ser desfeita.')) return;
  getSB().from('pei').delete().eq('id', peiId).then(function(r) {
    if (r.error) { alert('Erro: ' + r.error.message); return; }
    toast('PEI excluído! ✓');
    abrirPEIPaciente();
  });
}

function toggleMenuAv(btn) {
  var menu = btn.nextElementSibling;
  document.querySelectorAll('.menu-av').forEach(function(m) {
    if (m !== menu) m.style.display = 'none';
  });
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  setTimeout(function() {
    document.addEventListener('click', function fechar(e) {
      if (!btn.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', fechar);
      }
    });
  }, 10);
}

function excluirAvaliacao(avId) {
  if (!confirm('Excluir esta avaliação? Todos os dados de resposta serão perdidos.')) return;
  getSB().from('avaliacoes').delete().eq('id', avId).then(function(r) {
    if (r.error) { alert('Erro: ' + r.error.message); return; }
    toast('Avaliação excluída! ✓');
    carregarAvaliacoesPaciente();
  });
}

function exportarPEIPDF() {
  // Criar elemento de estilo temporário para impressão
  var style = document.createElement('style');
  style.id = 'print-style-temp';
  style.innerHTML = '@media print { .sidebar, aside, #pgLoading { display:none!important; } .app { display:block!important; } .view { display:block!important; height:auto!important; overflow:visible!important; } .view:not(.on) { display:none!important; } }';
  document.head.appendChild(style);
  window.print();
  setTimeout(function() {
    var el = document.getElementById('print-style-temp');
    if (el) el.remove();
  }, 1000);
}
