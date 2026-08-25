let network;
let users=[];

const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const api=async(url,options={})=>{
  const res=await fetch(url,{headers:{'Content-Type':'application/json'},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||'Request failed.');
  return data;
};

function notify(message,type='success'){
  const title={success:'Updated',warning:'Network changed',danger:'Action failed'}[type]||'Notice';
  $('toastTitle').textContent=title;
  $('toastMessage').textContent=message;
  $('toastIcon').className=`toast-status ${type}`;
  bootstrap.Toast.getOrCreateInstance($('appToast'),{delay:2600}).show();
}

function optionsHtml(){
  if(!users.length)return '<option value="">No users available</option>';
  return users.map(u=>`<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
}

function refreshSelects(){
  const ids=['removeUser','friendA','friendB','analysisA','analysisB'];
  const previous=Object.fromEntries(ids.map(id=>[id,$(id).value]));
  const html=optionsHtml();
  ids.forEach(id=>{
    $(id).innerHTML=html;
    if(previous[id]&&users.some(u=>String(u.id)===String(previous[id])))$(id).value=previous[id];
  });
  if(users.length>1){
    if($('friendA').value===$('friendB').value)$('friendB').selectedIndex=1;
    if($('analysisA').value===$('analysisB').value)$('analysisB').selectedIndex=1;
  }
  const insufficient=users.length<2;
  ['addFriendBtn','removeFriendBtn','pathBtn','mutualBtn'].forEach(id=>$(id).disabled=insufficient);
  $('removeUserBtn').disabled=!users.length;
  $('groupsBtn').disabled=!users.length;
}

async function loadAll(){
  users=await api('/api/users');
  refreshSelects();
  await Promise.all([loadGraph(),loadSummary()]);
}

function edgeKey(a,b){
  const x=Number(a),y=Number(b);
  return x<y?`${x}-${y}`:`${y}-${x}`;
}

async function loadGraph(highlightNodes=[],highlightEdges=[]){
  const data=await api('/api/graph');
  const highlightedNodeSet=new Set(highlightNodes.map(Number));
  const highlightedEdgeSet=new Set(highlightEdges.map(([a,b])=>edgeKey(a,b)));

  const nodes=new vis.DataSet(data.nodes.map(n=>({
    id:n.id,
    label:n.label,
    value:Math.max(n.degree,1),
    title:`${escapeHtml(n.label)}<br>Friends: ${n.degree}`,
    borderWidth:highlightedNodeSet.has(Number(n.id))?4:2,
    color:highlightedNodeSet.has(Number(n.id))
      ?{background:'#ffc107',border:'#fd7e14',highlight:{background:'#ffca2c',border:'#fd7e14'}}
      :{background:'#b9d5ff',border:'#5b9cf6',highlight:{background:'#9ec5fe',border:'#0d6efd'}}
  })));

  const edges=new vis.DataSet(data.edges.map(e=>{
    const highlighted=highlightedEdgeSet.has(edgeKey(e.from,e.to));
    return {
      from:e.from,
      to:e.to,
      width:highlighted?4:1.6,
      color:highlighted?{color:'#fd7e14',highlight:'#fd7e14'}:{color:'#c4cfdd',highlight:'#7daaf0'}
    };
  }));

  if(network)network.destroy();
  const options={
    autoResize:true,
    nodes:{shape:'dot',font:{size:14,color:'#344054',face:'system-ui'},scaling:{min:17,max:34},shadow:{enabled:true,size:7,x:0,y:3,color:'rgba(31,45,61,.10)'}},
    edges:{smooth:{enabled:true,type:'continuous',roundness:.25}},
    physics:{stabilization:{iterations:140,fit:true},barnesHut:{gravitationalConstant:-3200,springLength:120,springConstant:.035,damping:.15}},
    interaction:{hover:true,tooltipDelay:90,navigationButtons:false,keyboard:false,zoomView:true,dragView:true}
  };
  network=new vis.Network($('network'),{nodes,edges},options);
}

async function loadSummary(){
  const s=await api('/api/analysis/summary');
  const top=s.most_connected.length?s.most_connected.map(x=>`${escapeHtml(x.name)} (${x.degree})`).join(', '):'None yet';
  $('stats').innerHTML=`
    <div class="stat-tile"><span class="stat-icon"><i class="fa-solid fa-users"></i></span><div class="stat-copy"><div class="stat-label">Users</div><div class="stat-value">${s.users}</div></div></div>
    <div class="stat-tile"><span class="stat-icon"><i class="fa-solid fa-link"></i></span><div class="stat-copy"><div class="stat-label">Friendships</div><div class="stat-value">${s.friendships}</div></div></div>
    <div class="stat-tile"><span class="stat-icon"><i class="fa-solid fa-people-group"></i></span><div class="stat-copy"><div class="stat-label">Groups</div><div class="stat-value">${s.groups}</div></div></div>
    <div class="stat-tile"><span class="stat-icon"><i class="fa-solid fa-chart-pie"></i></span><div class="stat-copy"><div class="stat-label">Density</div><div class="stat-value">${s.density}</div></div></div>
    <div class="stat-tile"><span class="stat-icon"><i class="fa-solid fa-crown"></i></span><div class="stat-copy"><div class="stat-label">Most connected</div><div class="stat-value compact" title="${top}">${top}</div></div></div>`;
}

async function addUser(){
  try{
    const name=$('newUserName').value.trim();
    if(!name){notify('Enter a name first.','danger');return;}
    await api('/api/users',{method:'POST',body:JSON.stringify({name})});
    $('newUserName').value='';
    notify(`${name} was added to the network.`);
    await loadAll();
  }catch(e){notify(e.message,'danger');}
}

$('addUserBtn').onclick=addUser;
$('newUserName').addEventListener('keydown',e=>{if(e.key==='Enter')addUser();});

$('removeUserBtn').onclick=async()=>{
  const id=$('removeUser').value;if(!id)return;
  const name=$('removeUser').selectedOptions[0].text;
  if(!confirm(`Remove ${name} and all associated friendships?`))return;
  try{
    await api(`/api/users/${id}`,{method:'DELETE'});
    notify(`${name} was removed with associated friendships.`,'warning');
    await loadAll();
  }catch(e){notify(e.message,'danger');}
};

async function friendshipAction(method){
  const a=$('friendA').value,b=$('friendB').value;
  if(!a||!b){notify('Add at least two users first.','danger');return;}
  if(a===b){notify('Choose two different users.','danger');return;}
  const nameA=$('friendA').selectedOptions[0].text;
  const nameB=$('friendB').selectedOptions[0].text;
  try{
    await api('/api/friendships',{method,body:JSON.stringify({user1_id:a,user2_id:b})});
    notify(method==='POST'?`${nameA} and ${nameB} are now connected.`:`Friendship between ${nameA} and ${nameB} was removed.`,method==='POST'?'success':'warning');
    await loadAll();
  }catch(e){notify(e.message,'danger');}
}

$('addFriendBtn').onclick=()=>friendshipAction('POST');
$('removeFriendBtn').onclick=()=>friendshipAction('DELETE');
$('fitGraphBtn').onclick=()=>network&&network.fit({animation:{duration:350,easingFunction:'easeInOutQuad'}});
$('resetGraphBtn').onclick=async()=>{
  await loadGraph();
  $('result').innerHTML=`<div class="empty-state"><i class="fa-solid fa-share-nodes"></i><strong>Ready to analyze</strong><span>Select two people and choose an algorithm.</span></div>`;
};

$('pathBtn').onclick=async()=>{
  try{
    const a=$('analysisA').value,b=$('analysisB').value;
    if(a===b){notify('Choose two different people to find a path.','danger');return;}
    const r=await api(`/api/analysis/path/${a}/${b}`);
    if(!r.path.length){
      $('result').innerHTML='<div class="empty-state"><i class="fa-solid fa-link-slash"></i><strong>No connection found</strong><span>These users are in separate components of the current graph.</span></div>';
      await loadGraph();
      return;
    }
    const ids=r.path.map(x=>x.id);
    const edges=r.path.slice(0,-1).map((x,i)=>[x.id,r.path[i+1].id]);
    await loadGraph(ids,edges);
    const flow=r.path.map((x,i)=>`${i?'<span class="path-arrow"><i class="fa-solid fa-chevron-right"></i></span>':''}<span class="path-node">${escapeHtml(x.name)}</span>`).join('');
    $('result').innerHTML=`<div class="result-heading"><i class="fa-solid fa-route me-1 text-primary"></i>Shortest connection</div><div class="path-flow">${flow}</div><div class="small-note mt-2">${r.degrees_of_separation} degree${r.degrees_of_separation===1?'':'s'} of separation</div>`;
  }catch(e){notify(e.message,'danger');}
};

$('mutualBtn').onclick=async()=>{
  try{
    const a=$('analysisA').value,b=$('analysisB').value;
    if(a===b){notify('Choose two different people.','danger');return;}
    const r=await api(`/api/analysis/mutual/${a}/${b}`);
    $('result').innerHTML=r.length
      ?`<div class="result-heading"><i class="fa-solid fa-user-group me-1 text-primary"></i>Mutual friends</div><div class="d-flex flex-wrap gap-1">${r.map(x=>`<span class="path-node">${escapeHtml(x.name)}</span>`).join('')}</div><div class="small-note mt-2">${r.length} mutual friend${r.length===1?'':'s'} found.</div>`
      :'<div class="empty-state"><i class="fa-solid fa-user-group"></i><strong>No mutual friends</strong><span>The selected users do not share a direct neighbor.</span></div>';
    await loadGraph(r.map(x=>x.id));
  }catch(e){notify(e.message,'danger');}
};

$('groupsBtn').onclick=async()=>{
  try{
    const r=await api('/api/analysis/components');
    $('result').innerHTML=`<div class="result-heading"><i class="fa-solid fa-people-group me-1 text-secondary"></i>Connected groups</div>${r.map(g=>`<div class="group-item"><span class="badge badge-soft">Group ${g.group}</span><div class="small-note mt-1">${g.members.map(escapeHtml).join(', ')}</div></div>`).join('')}`;
    await loadGraph();
  }catch(e){notify(e.message,'danger');}
};

loadAll().catch(e=>notify(e.message,'danger'));
