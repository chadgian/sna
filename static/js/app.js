let network;
let nodeSet;
let edgeSet;
let users=[];
let graphData={nodes:[],edges:[]};
let selectedNodeId=null;
let focusConnectedOnly=false;
let activeSuggestions=[];
let highlightedNodes=new Set();
let highlightedEdges=new Set();
let hoveredNodeId=null;
let graphDragging=false;
let suggestionRequestToken=0;

const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const api=async(url,options={})=>{
  const res=await fetch(url,{headers:{'Content-Type':'application/json'},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Request failed.');
  return data;
};

function notify(message,type='success'){
  const title={success:'Updated',warning:'Network changed',danger:'Action failed'}[type]||'Notice';
  $('toastTitle').textContent=title;
  $('toastMessage').textContent=message;
  $('toastIcon').className=`toast-status ${type}`;
  bootstrap.Toast.getOrCreateInstance($('appToast'),{delay:2600}).show();
}

function getUser(id){return users.find(u=>String(u.id)===String(id));}
function graphNode(id){return graphData.nodes.find(n=>String(n.id)===String(id));}
function edgeKey(a,b){const x=Number(a),y=Number(b);return x<y?`${x}-${y}`:`${y}-${x}`;}

function optionsHtml(){
  if(!users.length)return '<option value="">No users available</option>';
  return users.map(u=>`<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
}

function refreshSelects(preferredProfileId=null){
  const ids=['profileUser','friendA','friendB','analysisA','analysisB'];
  const previous=Object.fromEntries(ids.map(id=>[id,$(id).value]));
  const html=optionsHtml();
  ids.forEach(id=>{
    $(id).innerHTML=html;
    const wanted=id==='profileUser'&&preferredProfileId?String(preferredProfileId):previous[id];
    if(wanted&&users.some(u=>String(u.id)===String(wanted)))$(id).value=wanted;
  });
  if(users.length>1){
    if($('friendA').value===$('friendB').value)$('friendB').selectedIndex=1;
    if($('analysisA').value===$('analysisB').value)$('analysisB').selectedIndex=1;
  }
  const insufficient=users.length<2;
  ['addFriendBtn','removeFriendBtn','pathBtn','mutualBtn'].forEach(id=>$(id).disabled=insufficient);
  $('suggestBtn').disabled=!users.length;
  $('removeUserBtn').disabled=!users.length;
  $('editProfileBtn').disabled=!users.length;
  $('groupsBtn').disabled=!users.length;
  updateProfilePreview();
}

async function loadAll(preferredProfileId=null){
  users=await api('/api/users');
  refreshSelects(preferredProfileId);
  await Promise.all([loadGraphData(),loadSummary()]);
}

function adjacencyMap(){
  const map=new Map(graphData.nodes.map(n=>[Number(n.id),new Set()]));
  graphData.edges.forEach(e=>{
    const a=Number(e.from),b=Number(e.to);
    if(!map.has(a))map.set(a,new Set());
    if(!map.has(b))map.set(b,new Set());
    map.get(a).add(b);map.get(b).add(a);
  });
  return map;
}

function selectedNeighborhood(){
  if(selectedNodeId===null)return null;
  const map=adjacencyMap();
  const set=new Set([Number(selectedNodeId)]);
  (map.get(Number(selectedNodeId))||new Set()).forEach(id=>set.add(id));
  return set;
}

function baseNodeStyle(n){
  return {
    id:n.id,label:n.label,value:Math.max(n.degree,1),hidden:false,
    borderWidth:2,
    color:{background:'#b9d5ff',border:'#5b9cf6',highlight:{background:'#9ec5fe',border:'#0d6efd'}},
    font:{color:'#344054'}
  };
}

function renderVisualState(){
  if(!nodeSet||!edgeSet)return;
  const neighborhood=selectedNeighborhood();
  const source=selectedNodeId===null?null:Number(selectedNodeId);

  const nodeUpdates=graphData.nodes.map(n=>{
    const id=Number(n.id);
    const node=baseNodeStyle(n);
    const isHighlighted=highlightedNodes.has(id);
    const isSelected=source!==null&&id===source;
    const isNeighbor=neighborhood?.has(id);
    const shouldHide=Boolean(focusConnectedOnly&&neighborhood&&!isNeighbor);
    node.hidden=shouldHide;

    if(isHighlighted){
      node.borderWidth=4;
      node.color={background:'#ffc107',border:'#fd7e14',highlight:{background:'#ffca2c',border:'#fd7e14'}};
      node.font={color:'#533f03'};
    }else if(isSelected){
      node.borderWidth=4;
      node.color={background:'#8bbcff',border:'#0d6efd',highlight:{background:'#9ec5fe',border:'#0b5ed7'}};
      node.font={color:'#173f75'};
    }else if(neighborhood&&!isNeighbor){
      node.borderWidth=1;
      node.color={background:'#edf0f3',border:'#d7dde5',highlight:{background:'#e4e8ed',border:'#c4ccd6'}};
      node.font={color:'#a2aab5'};
    }
    return node;
  });
  nodeSet.update(nodeUpdates);

  const suggestionIds=edgeSet.getIds({filter:item=>String(item.id).startsWith('suggest:')});
  if(suggestionIds.length)edgeSet.remove(suggestionIds);

  const baseEdgeUpdates=graphData.edges.map(e=>{
    const a=Number(e.from),b=Number(e.to);
    const highlighted=highlightedEdges.has(edgeKey(a,b));
    const touchesSelected=source!==null&&(a===source||b===source);
    const hidden=Boolean(focusConnectedOnly&&neighborhood&&(!neighborhood.has(a)||!neighborhood.has(b)));
    let color='#c4cfdd',width=1.6;
    if(highlighted){color='#fd7e14';width=4;}
    else if(source!==null&&!touchesSelected){color='#e0e5eb';width=1.1;}
    else if(touchesSelected){color='#86aee8';width=2.1;}
    return {id:`friend:${edgeKey(a,b)}`,from:a,to:b,hidden,width,color:{color,highlight:color},dashes:false};
  });
  edgeSet.update(baseEdgeUpdates);

  if(source!==null&&!focusConnectedOnly&&activeSuggestions.length){
    const realEdges=new Set(graphData.edges.map(e=>edgeKey(e.from,e.to)));
    const suggestionItems=activeSuggestions.slice(0,3).filter(s=>!realEdges.has(edgeKey(source,s.id))).map(s=>({
      id:`suggest:${edgeKey(source,s.id)}`,
      from:source,to:Number(s.id),
      width:1.2,dashes:[5,7],
      color:{color:'rgba(91,137,108,.55)',highlight:'rgba(62,118,84,.75)'},
      smooth:{enabled:true,type:'curvedCW',roundness:.08},
      chosen:false,
      shadow:false
    }));
    if(suggestionItems.length)edgeSet.add(suggestionItems);
  }
  updateFocusButton();
}

async function loadGraphData(){
  graphData=await api('/api/graph');
  if(selectedNodeId!==null&&!graphData.nodes.some(n=>Number(n.id)===Number(selectedNodeId))){
    selectedNodeId=null;focusConnectedOnly=false;activeSuggestions=[];
  }

  const nodes=new vis.DataSet(graphData.nodes.map(baseNodeStyle));
  const edges=new vis.DataSet(graphData.edges.map(e=>({
    id:`friend:${edgeKey(e.from,e.to)}`,from:Number(e.from),to:Number(e.to),width:1.6,dashes:false,
    color:{color:'#c4cfdd',highlight:'#7daaf0'}
  })));

  if(network)network.destroy();
  nodeSet=nodes;edgeSet=edges;
  const options={
    autoResize:true,
    nodes:{shape:'dot',font:{size:14,color:'#344054',face:'system-ui'},scaling:{min:17,max:34},shadow:{enabled:true,size:7,x:0,y:3,color:'rgba(31,45,61,.10)'}},
    edges:{smooth:{enabled:true,type:'continuous',roundness:.25}},
    physics:{stabilization:{iterations:140,fit:true},barnesHut:{gravitationalConstant:-3200,springLength:120,springConstant:.035,damping:.15}},
    interaction:{hover:true,tooltipDelay:0,navigationButtons:false,keyboard:false,zoomView:true,dragView:true}
  };
  network=new vis.Network($('network'),{nodes:nodeSet,edges:edgeSet},options);
  bindGraphEvents();
  renderVisualState();
}

function tooltipContent(n){
  const meta=[n.age_group,n.hometown,n.occupation].filter(Boolean);
  return `
    <div class="graph-tooltip-name">${escapeHtml(n.label)}</div>
    <div class="graph-tooltip-meta">${meta.length?meta.map(escapeHtml).join(' • '):'Profile details not specified'}</div>
    <div class="graph-tooltip-row"><span class="graph-tooltip-label">Friends:</span> ${n.degree}</div>
    ${n.interests?.length?`<div class="graph-tooltip-interests">${n.interests.slice(0,6).map(x=>`<span class="graph-tooltip-chip">${escapeHtml(x)}</span>`).join('')}${n.interests.length>6?`<span class="graph-tooltip-chip">+${n.interests.length-6}</span>`:''}</div>`:''}`;
}

function updateTooltipPosition(){
  if(!network||hoveredNodeId===null)return;
  const n=graphNode(hoveredNodeId);
  if(!n)return;
  const pos=network.getPositions([hoveredNodeId])[hoveredNodeId];
  if(!pos)return;
  const dom=network.canvasToDOM(pos);
  const tip=$('graphTooltip');
  const stage=tip.parentElement;
  const net=$('network');
  tip.style.transform='none';
  const width=tip.offsetWidth||210;
  const height=tip.offsetHeight||100;
  let left=net.offsetLeft+dom.x+18;
  let top=net.offsetTop+dom.y-height/2;
  if(left+width>stage.clientWidth-8)left=net.offsetLeft+dom.x-width-18;
  left=Math.max(8,left);
  top=Math.max(8,Math.min(top,stage.clientHeight-height-8));
  tip.style.left=`${left}px`;
  tip.style.top=`${top}px`;
}

function showTooltip(id){
  const n=graphNode(id);
  if(!n)return;
  hoveredNodeId=Number(id);
  const tip=$('graphTooltip');
  tip.innerHTML=tooltipContent(n);
  tip.classList.add('show');
  tip.setAttribute('aria-hidden','false');
  requestAnimationFrame(updateTooltipPosition);
}

function hideTooltip(){
  hoveredNodeId=null;
  const tip=$('graphTooltip');
  tip.classList.remove('show');
  tip.setAttribute('aria-hidden','true');
}

function bindGraphEvents(){
  network.on('hoverNode',params=>showTooltip(params.node));
  network.on('blurNode',()=>{if(!graphDragging)hideTooltip();});
  network.on('dragStart',()=>{graphDragging=true;});
  network.on('dragEnd',params=>{
    graphDragging=false;
    const id=network.getNodeAt(params.pointer.DOM);
    if(id!==undefined&&id!==null)showTooltip(id);else hideTooltip();
  });
  network.on('afterDrawing',()=>{if(hoveredNodeId!==null)updateTooltipPosition();});
  network.on('click',async params=>{
    if(!params.nodes.length)return;
    const id=Number(params.nodes[0]);
    selectedNodeId=id;
    highlightedNodes.clear();highlightedEdges.clear();
    if(getUser(id)){
      $('profileUser').value=String(id);updateProfilePreview();
      $('analysisA').value=String(id);
    }
    renderVisualState();
    await loadSuggestionEdges(id);
  });
}

async function loadSuggestionEdges(sourceId){
  const token=++suggestionRequestToken;
  try{
    const r=await api(`/api/analysis/suggestions/${sourceId}`);
    if(token!==suggestionRequestToken||Number(selectedNodeId)!==Number(sourceId))return;
    activeSuggestions=r.slice(0,3);
    renderVisualState();
  }catch(_){
    if(token===suggestionRequestToken){activeSuggestions=[];renderVisualState();}
  }
}

function updateFocusButton(){
  const btn=$('focusGraphBtn');
  if(!btn)return;
  btn.classList.toggle('active',focusConnectedOnly);
  btn.setAttribute('aria-pressed',String(focusConnectedOnly));
  const icon=btn.querySelector('i');
  if(icon)icon.className=focusConnectedOnly?'fa-solid fa-eye-slash':'fa-solid fa-eye';
}

function clearGraphState(){
  selectedNodeId=null;focusConnectedOnly=false;activeSuggestions=[];
  highlightedNodes.clear();highlightedEdges.clear();
  suggestionRequestToken++;
  hideTooltip();
  renderVisualState();
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

function interestBadges(interests=[],limit=4){
  if(!interests.length)return '<span class="profile-empty">No interests yet</span>';
  const visible=interests.slice(0,limit).map(x=>`<span class="interest-chip">${escapeHtml(x)}</span>`).join('');
  const extra=interests.length>limit?`<span class="interest-chip muted">+${interests.length-limit}</span>`:'';
  return visible+extra;
}

function updateProfilePreview(){
  const user=getUser($('profileUser').value);
  if(!user){$('profilePreview').innerHTML='<div class="empty-profile"><i class="fa-regular fa-id-card"></i><span>Add a profile to begin.</span></div>';return;}
  const meta=[user.age_group,user.hometown,user.occupation].filter(Boolean).map(escapeHtml);
  $('profilePreview').innerHTML=`
    <div class="profile-name-row"><div class="profile-avatar">${escapeHtml(user.name.charAt(0).toUpperCase())}</div><div class="min-w-0"><div class="profile-name text-truncate">${escapeHtml(user.name)}</div><div class="profile-meta text-truncate">${meta.length?meta.join(' • '):'Profile details not added yet'}</div></div></div>
    <div class="interest-wrap">${interestBadges(user.interests)}</div>${user.bio?`<div class="profile-bio">${escapeHtml(user.bio)}</div>`:''}`;
}

function openProfileModal(user=null){
  $('profileModalLabel').textContent=user?'Edit profile':'Add profile';
  $('profileId').value=user?.id||'';$('profileName').value=user?.name||'';$('profileAgeGroup').value=user?.age_group||'';$('profileHometown').value=user?.hometown||'';$('profileOccupation').value=user?.occupation||'';$('profileInterests').value=(user?.interests||[]).join(', ');$('profileBio').value=user?.bio||'';
  bootstrap.Modal.getOrCreateInstance($('profileModal')).show();setTimeout(()=>$('profileName').focus(),180);
}

$('newProfileBtn').onclick=()=>openProfileModal();
$('editProfileBtn').onclick=()=>{const user=getUser($('profileUser').value);if(user)openProfileModal(user);};
$('profileUser').onchange=updateProfilePreview;

$('saveProfileBtn').onclick=async()=>{
  const id=$('profileId').value,name=$('profileName').value.trim();
  if(!name){notify('Name is required.','danger');return;}
  const payload={name,age_group:$('profileAgeGroup').value,hometown:$('profileHometown').value.trim(),occupation:$('profileOccupation').value.trim(),interests:$('profileInterests').value.split(',').map(x=>x.trim()).filter(Boolean),bio:$('profileBio').value.trim()};
  try{
    const saved=await api(id?`/api/users/${id}`:'/api/users',{method:id?'PUT':'POST',body:JSON.stringify(payload)});
    bootstrap.Modal.getOrCreateInstance($('profileModal')).hide();notify(id?`${saved.name}'s profile was updated.`:`${saved.name} was added to the network.`);clearGraphState();await loadAll(saved.id);
  }catch(e){notify(e.message,'danger');}
};

$('removeUserBtn').onclick=async()=>{
  const id=$('profileUser').value,user=getUser(id);if(!id||!user)return;
  if(!confirm(`Remove ${user.name} and all associated friendships?`))return;
  try{await api(`/api/users/${id}`,{method:'DELETE'});notify(`${user.name} was removed with associated friendships.`,'warning');clearGraphState();await loadAll();}catch(e){notify(e.message,'danger');}
};

async function friendshipAction(method,aOverride=null,bOverride=null){
  const a=String(aOverride||$('friendA').value),b=String(bOverride||$('friendB').value);
  if(!a||!b){notify('Add at least two users first.','danger');return false;}
  if(a===b){notify('Choose two different users.','danger');return false;}
  const userA=getUser(a),userB=getUser(b);
  try{
    await api('/api/friendships',{method,body:JSON.stringify({user1_id:a,user2_id:b})});
    notify(method==='POST'?`${userA?.name||'Users'} and ${userB?.name||''} are now connected.`:'Friendship was removed.',method==='POST'?'success':'warning');
    clearGraphState();await loadAll(a);return true;
  }catch(e){notify(e.message,'danger');return false;}
}

$('addFriendBtn').onclick=()=>friendshipAction('POST');
$('removeFriendBtn').onclick=()=>friendshipAction('DELETE');
$('fitGraphBtn').onclick=()=>network&&network.fit({animation:{duration:350,easingFunction:'easeInOutQuad'}});
$('focusGraphBtn').onclick=()=>{
  if(selectedNodeId===null){notify('Click a person in the graph first.','warning');return;}
  focusConnectedOnly=!focusConnectedOnly;renderVisualState();
  if(network)setTimeout(()=>network.fit({animation:{duration:280,easingFunction:'easeInOutQuad'}}),30);
};
$('resetGraphBtn').onclick=()=>{
  clearGraphState();
  $('result').innerHTML='<div class="empty-state"><i class="fa-solid fa-share-nodes"></i><strong>Ready to analyze</strong><span>Select people and choose an algorithm.</span></div>';
};

function beginAnalysis(){
  selectedNodeId=null;focusConnectedOnly=false;activeSuggestions=[];highlightedNodes.clear();highlightedEdges.clear();suggestionRequestToken++;hideTooltip();
}

$('pathBtn').onclick=async()=>{
  try{
    const a=$('analysisA').value,b=$('analysisB').value;if(a===b){notify('Choose two different people to find a path.','danger');return;}
    const r=await api(`/api/analysis/path/${a}/${b}`);beginAnalysis();
    if(!r.path.length){renderVisualState();$('result').innerHTML='<div class="empty-state"><i class="fa-solid fa-link-slash"></i><strong>No connection found</strong><span>These users are in separate components of the current graph.</span></div>';return;}
    r.path.forEach(x=>highlightedNodes.add(Number(x.id)));r.path.slice(0,-1).forEach((x,i)=>highlightedEdges.add(edgeKey(x.id,r.path[i+1].id)));renderVisualState();
    const flow=r.path.map((x,i)=>`${i?'<span class="path-arrow"><i class="fa-solid fa-chevron-right"></i></span>':''}<span class="path-node">${escapeHtml(x.name)}</span>`).join('');
    $('result').innerHTML=`<div class="result-heading"><i class="fa-solid fa-route me-1 text-primary"></i>Shortest connection</div><div class="path-flow">${flow}</div><div class="small-note mt-2">${r.degrees_of_separation} degree${r.degrees_of_separation===1?'':'s'} of separation</div>`;
  }catch(e){notify(e.message,'danger');}
};

$('mutualBtn').onclick=async()=>{
  try{
    const a=$('analysisA').value,b=$('analysisB').value;if(a===b){notify('Choose two different people.','danger');return;}
    const r=await api(`/api/analysis/mutual/${a}/${b}`);beginAnalysis();r.forEach(x=>highlightedNodes.add(Number(x.id)));renderVisualState();
    $('result').innerHTML=r.length?`<div class="result-heading"><i class="fa-solid fa-user-group me-1 text-primary"></i>Mutual friends</div><div class="d-flex flex-wrap gap-1">${r.map(x=>`<span class="path-node">${escapeHtml(x.name)}</span>`).join('')}</div><div class="small-note mt-2">${r.length} mutual friend${r.length===1?'':'s'} found.</div>`:'<div class="empty-state"><i class="fa-solid fa-user-group"></i><strong>No mutual friends</strong><span>The selected users do not share a direct neighbor.</span></div>';
  }catch(e){notify(e.message,'danger');}
};

$('groupsBtn').onclick=async()=>{
  try{
    const r=await api('/api/analysis/components');beginAnalysis();renderVisualState();
    $('result').innerHTML=`<div class="result-heading"><i class="fa-solid fa-people-group me-1 text-secondary"></i>Connected groups</div>${r.map(g=>`<div class="group-item"><span class="badge badge-soft">Group ${g.group}</span><div class="small-note mt-1">${g.members.map(escapeHtml).join(', ')}</div></div>`).join('')}`;
  }catch(e){notify(e.message,'danger');}
};

async function showSuggestions(){
  try{
    const sourceId=$('analysisA').value;if(!sourceId)return;const source=getUser(sourceId);const r=await api(`/api/analysis/suggestions/${sourceId}`);
    selectedNodeId=Number(sourceId);focusConnectedOnly=false;highlightedNodes.clear();highlightedEdges.clear();activeSuggestions=r.slice(0,3);renderVisualState();
    if(!r.length){$('result').innerHTML='<div class="empty-state"><i class="fa-solid fa-user-plus"></i><strong>No suggestions yet</strong><span>Add profile interests or more users to generate recommendations.</span></div>';return;}
    $('result').innerHTML=`<div class="result-heading"><i class="fa-solid fa-user-plus me-1 text-success"></i>Suggested friends for ${escapeHtml(source?.name||'user')}</div><div class="suggestion-list">${r.map(s=>`<div class="suggestion-card"><div class="suggestion-head"><div class="min-w-0"><div class="suggestion-name text-truncate">${escapeHtml(s.name)}</div><div class="small-note text-truncate">${[s.age_group,s.hometown,s.occupation].filter(Boolean).map(escapeHtml).join(' • ')||'Profile similarity'}</div></div><span class="match-score">${s.score}%</span></div>${s.shared_interests.length?`<div class="interest-wrap compact">${s.shared_interests.map(x=>`<span class="interest-chip">${escapeHtml(x)}</span>`).join('')}</div>`:''}<div class="suggestion-reasons">${s.reasons.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div><button class="btn btn-outline-success btn-sm w-100 suggestion-connect" data-user-id="${s.id}"><i class="fa-solid fa-link me-1"></i> Connect</button></div>`).join('')}</div>`;
  }catch(e){notify(e.message,'danger');}
}

$('suggestBtn').onclick=showSuggestions;
$('result').addEventListener('click',async e=>{
  const button=e.target.closest('.suggestion-connect');if(!button)return;
  const sourceId=$('analysisA').value,targetId=button.dataset.userId;
  const connected=await friendshipAction('POST',sourceId,targetId);
  if(connected){$('analysisA').value=String(sourceId);await showSuggestions();}
});

loadAll().catch(e=>notify(e.message,'danger'));
