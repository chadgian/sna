let network;
let users=[];

const $=id=>document.getElementById(id);
const api=async(url,options={})=>{
  const res=await fetch(url,{headers:{'Content-Type':'application/json'},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||'Request failed.');
  return data;
};

function notify(message,type='success'){
  $('alertBox').innerHTML=`<div class="alert alert-${type} alert-dismissible fade show" role="alert">${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
}

function optionsHtml(){
  return users.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
}

function refreshSelects(){
  ['removeUser','friendA','friendB','analysisA','analysisB'].forEach(id=>$(id).innerHTML=optionsHtml());
  if(users.length>1){$('friendB').selectedIndex=1;$('analysisB').selectedIndex=1;}
}

async function loadAll(){
  users=await api('/api/users');
  refreshSelects();
  await Promise.all([loadGraph(),loadSummary()]);
}

async function loadGraph(highlight=[]){
  const data=await api('/api/graph');
  const nodes=new vis.DataSet(data.nodes.map(n=>({
    id:n.id,label:n.label,
    value:Math.max(n.degree,1),
    title:`${n.label}<br>Friends: ${n.degree}`,
    borderWidth:highlight.includes(n.id)?4:1,
    color:highlight.includes(n.id)?{background:'#ffc107',border:'#fd7e14'}:undefined
  })));
  const edges=new vis.DataSet(data.edges.map(e=>({from:e.from,to:e.to,width:2})));
  const container=$('network');
  const options={
    nodes:{shape:'dot',font:{size:16},scaling:{min:18,max:38}},
    edges:{smooth:{type:'continuous'},color:{inherit:true}},
    physics:{stabilization:true,barnesHut:{gravitationalConstant:-3500,springLength:140}},
    interaction:{hover:true,tooltipDelay:100}
  };
  network=new vis.Network(container,{nodes,edges},options);
}

async function loadSummary(){
  const s=await api('/api/analysis/summary');
  const top=s.most_connected.length?s.most_connected.map(x=>`${x.name} (${x.degree})`).join(', '):'None';
  $('stats').innerHTML=`
    <div class="col-6 col-lg"><div class="card stat-card shadow-sm"><div class="card-body"><div class="label">Users</div><div class="value">${s.users}</div></div></div></div>
    <div class="col-6 col-lg"><div class="card stat-card shadow-sm"><div class="card-body"><div class="label">Friendships</div><div class="value">${s.friendships}</div></div></div></div>
    <div class="col-6 col-lg"><div class="card stat-card shadow-sm"><div class="card-body"><div class="label">Groups</div><div class="value">${s.groups}</div></div></div></div>
    <div class="col-6 col-lg"><div class="card stat-card shadow-sm"><div class="card-body"><div class="label">Density</div><div class="value">${s.density}</div></div></div></div>
    <div class="col-12 col-lg-4"><div class="card stat-card shadow-sm"><div class="card-body"><div class="label">Most Connected</div><div class="fw-semibold mt-2">${top}</div></div></div></div>`;
}

$('addUserBtn').onclick=async()=>{
  try{
    const name=$('newUserName').value.trim();
    await api('/api/users',{method:'POST',body:JSON.stringify({name})});
    $('newUserName').value=''; notify('User added.'); await loadAll();
  }catch(e){notify(e.message,'danger');}
};

$('removeUserBtn').onclick=async()=>{
  const id=$('removeUser').value;if(!id)return;
  const name=$('removeUser').selectedOptions[0].text;
  if(!confirm(`Remove ${name} and all associated friendships?`))return;
  try{await api(`/api/users/${id}`,{method:'DELETE'});notify('User removed.','warning');await loadAll();}catch(e){notify(e.message,'danger');}
};

async function friendshipAction(method){
  const a=$('friendA').value,b=$('friendB').value;
  if(a===b){notify('Choose two different users.','danger');return;}
  try{
    await api('/api/friendships',{method,body:JSON.stringify({user1_id:a,user2_id:b})});
    notify(method==='POST'?'Friendship added.':'Friendship removed.',method==='POST'?'success':'warning');
    await loadAll();
  }catch(e){notify(e.message,'danger');}
}
$('addFriendBtn').onclick=()=>friendshipAction('POST');
$('removeFriendBtn').onclick=()=>friendshipAction('DELETE');
$('fitGraphBtn').onclick=()=>network&&network.fit({animation:true});

$('pathBtn').onclick=async()=>{
  try{
    const a=$('analysisA').value,b=$('analysisB').value;
    const r=await api(`/api/analysis/path/${a}/${b}`);
    if(!r.path.length){$('result').innerHTML='<span class="text-danger">No connection exists between these users.</span>';await loadGraph();return;}
    const ids=r.path.map(x=>x.id);await loadGraph(ids);
    $('result').innerHTML=`<div class="fw-semibold mb-2">Shortest connection</div><div>${r.path.map(x=>x.name).join(' → ')}</div><div class="small-note mt-2">Degrees of separation: ${r.degrees_of_separation}</div>`;
  }catch(e){notify(e.message,'danger');}
};

$('mutualBtn').onclick=async()=>{
  try{
    const a=$('analysisA').value,b=$('analysisB').value;
    const r=await api(`/api/analysis/mutual/${a}/${b}`);
    $('result').innerHTML=r.length?`<div class="fw-semibold mb-2">Mutual friends</div><ul class="result-list">${r.map(x=>`<li>${x.name}</li>`).join('')}</ul>`:'<span class="text-muted">No mutual friends found.</span>';
    await loadGraph(r.map(x=>x.id));
  }catch(e){notify(e.message,'danger');}
};

$('groupsBtn').onclick=async()=>{
  try{
    const r=await api('/api/analysis/components');
    $('result').innerHTML=`<div class="fw-semibold mb-2">Connected groups</div>${r.map(g=>`<div class="mb-2"><span class="badge badge-soft">Group ${g.group}</span><div class="small-note mt-1">${g.members.join(', ')}</div></div>`).join('')}`;
    await loadGraph();
  }catch(e){notify(e.message,'danger');}
};

loadAll().catch(e=>notify(e.message,'danger'));
