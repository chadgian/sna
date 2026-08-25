let network;
let users=[];

const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
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

function getUser(id){
  return users.find(u=>String(u.id)===String(id));
}

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
  await Promise.all([loadGraph(),loadSummary()]);
}

function edgeKey(a,b){
  const x=Number(a),y=Number(b);
  return x<y?`${x}-${y}`:`${y}-${x}`;
}

function profileTooltip(n){
  const details=[`<strong>${escapeHtml(n.label)}</strong>`,`Friends: ${n.degree}`];
  if(n.occupation)details.push(escapeHtml(n.occupation));
  if(n.hometown)details.push(`Hometown: ${escapeHtml(n.hometown)}`);
  if(n.age_group)details.push(`Age group: ${escapeHtml(n.age_group)}`);
  if(n.interests?.length)details.push(`Interests: ${n.interests.map(escapeHtml).join(', ')}`);
  return details.join('<br>');
}

async function loadGraph(highlightNodes=[],highlightEdges=[]){
  const data=await api('/api/graph');
  const highlightedNodeSet=new Set(highlightNodes.map(Number));
  const highlightedEdgeSet=new Set(highlightEdges.map(([a,b])=>edgeKey(a,b)));

  const nodes=new vis.DataSet(data.nodes.map(n=>({
    id:n.id,
    label:n.label,
    value:Math.max(n.degree,1),
    title:profileTooltip(n),
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
  network.on('click',params=>{
    if(!params.nodes.length)return;
    const id=params.nodes[0];
    if(getUser(id)){
      $('profileUser').value=String(id);
      updateProfilePreview();
    }
  });
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
  if(!user){
    $('profilePreview').innerHTML='<div class="empty-profile"><i class="fa-regular fa-id-card"></i><span>Add a profile to begin.</span></div>';
    return;
  }
  const meta=[user.age_group,user.hometown,user.occupation].filter(Boolean).map(escapeHtml);
  $('profilePreview').innerHTML=`
    <div class="profile-name-row">
      <div class="profile-avatar">${escapeHtml(user.name.charAt(0).toUpperCase())}</div>
      <div class="min-w-0">
        <div class="profile-name text-truncate">${escapeHtml(user.name)}</div>
        <div class="profile-meta text-truncate">${meta.length?meta.join(' • '):'Profile details not added yet'}</div>
      </div>
    </div>
    <div class="interest-wrap">${interestBadges(user.interests)}</div>
    ${user.bio?`<div class="profile-bio">${escapeHtml(user.bio)}</div>`:''}`;
}

function openProfileModal(user=null){
  $('profileModalLabel').textContent=user?'Edit profile':'Add profile';
  $('profileId').value=user?.id||'';
  $('profileName').value=user?.name||'';
  $('profileAgeGroup').value=user?.age_group||'';
  $('profileHometown').value=user?.hometown||'';
  $('profileOccupation').value=user?.occupation||'';
  $('profileInterests').value=(user?.interests||[]).join(', ');
  $('profileBio').value=user?.bio||'';
  bootstrap.Modal.getOrCreateInstance($('profileModal')).show();
  setTimeout(()=>$('profileName').focus(),180);
}

$('newProfileBtn').onclick=()=>openProfileModal();
$('editProfileBtn').onclick=()=>{
  const user=getUser($('profileUser').value);
  if(user)openProfileModal(user);
};
$('profileUser').onchange=updateProfilePreview;

$('saveProfileBtn').onclick=async()=>{
  const id=$('profileId').value;
  const name=$('profileName').value.trim();
  if(!name){notify('Name is required.','danger');return;}
  const payload={
    name,
    age_group:$('profileAgeGroup').value,
    hometown:$('profileHometown').value.trim(),
    occupation:$('profileOccupation').value.trim(),
    interests:$('profileInterests').value.split(',').map(x=>x.trim()).filter(Boolean),
    bio:$('profileBio').value.trim()
  };
  try{
    const saved=await api(id?`/api/users/${id}`:'/api/users',{
      method:id?'PUT':'POST',
      body:JSON.stringify(payload)
    });
    bootstrap.Modal.getOrCreateInstance($('profileModal')).hide();
    notify(id?`${saved.name}'s profile was updated.`:`${saved.name} was added to the network.`);
    await loadAll(saved.id);
  }catch(e){notify(e.message,'danger');}
};

$('removeUserBtn').onclick=async()=>{
  const id=$('profileUser').value;
  const user=getUser(id);
  if(!id||!user)return;
  if(!confirm(`Remove ${user.name} and all associated friendships?`))return;
  try{
    await api(`/api/users/${id}`,{method:'DELETE'});
    notify(`${user.name} was removed with associated friendships.`,'warning');
    await loadAll();
  }catch(e){notify(e.message,'danger');}
};

async function friendshipAction(method,aOverride=null,bOverride=null){
  const a=String(aOverride||$('friendA').value),b=String(bOverride||$('friendB').value);
  if(!a||!b){notify('Add at least two users first.','danger');return false;}
  if(a===b){notify('Choose two different users.','danger');return false;}
  const userA=getUser(a),userB=getUser(b);
  try{
    await api('/api/friendships',{method,body:JSON.stringify({user1_id:a,user2_id:b})});
    notify(method==='POST'?`${userA?.name||'Users'} and ${userB?.name||''} are now connected.`:'Friendship was removed.',method==='POST'?'success':'warning');
    await loadAll(a);
    return true;
  }catch(e){notify(e.message,'danger');return false;}
}

$('addFriendBtn').onclick=()=>friendshipAction('POST');
$('removeFriendBtn').onclick=()=>friendshipAction('DELETE');
$('fitGraphBtn').onclick=()=>network&&network.fit({animation:{duration:350,easingFunction:'easeInOutQuad'}});
$('resetGraphBtn').onclick=async()=>{
  await loadGraph();
  $('result').innerHTML='<div class="empty-state"><i class="fa-solid fa-share-nodes"></i><strong>Ready to analyze</strong><span>Select people and choose an algorithm.</span></div>';
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

async function showSuggestions(){
  try{
    const sourceId=$('analysisA').value;
    if(!sourceId)return;
    const source=getUser(sourceId);
    const r=await api(`/api/analysis/suggestions/${sourceId}`);
    if(!r.length){
      $('result').innerHTML='<div class="empty-state"><i class="fa-solid fa-user-plus"></i><strong>No suggestions yet</strong><span>Add profile interests or more users to generate recommendations.</span></div>';
      await loadGraph([Number(sourceId)]);
      return;
    }
    $('result').innerHTML=`
      <div class="result-heading"><i class="fa-solid fa-user-plus me-1 text-success"></i>Suggested friends for ${escapeHtml(source?.name||'user')}</div>
      <div class="suggestion-list">
        ${r.map(s=>`
          <div class="suggestion-card">
            <div class="suggestion-head">
              <div class="min-w-0">
                <div class="suggestion-name text-truncate">${escapeHtml(s.name)}</div>
                <div class="small-note text-truncate">${[s.age_group,s.hometown,s.occupation].filter(Boolean).map(escapeHtml).join(' • ')||'Profile similarity'}</div>
              </div>
              <span class="match-score">${s.score}%</span>
            </div>
            ${s.shared_interests.length?`<div class="interest-wrap compact">${s.shared_interests.map(x=>`<span class="interest-chip">${escapeHtml(x)}</span>`).join('')}</div>`:''}
            <div class="suggestion-reasons">${s.reasons.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div>
            <button class="btn btn-outline-success btn-sm w-100 suggestion-connect" data-user-id="${s.id}">
              <i class="fa-solid fa-link me-1"></i> Connect
            </button>
          </div>`).join('')}
      </div>`;
    await loadGraph([Number(sourceId),...r.map(x=>Number(x.id))]);
  }catch(e){notify(e.message,'danger');}
}

$('suggestBtn').onclick=showSuggestions;

$('result').addEventListener('click',async e=>{
  const button=e.target.closest('.suggestion-connect');
  if(!button)return;
  const sourceId=$('analysisA').value;
  const targetId=button.dataset.userId;
  const connected=await friendshipAction('POST',sourceId,targetId);
  if(connected){
    $('analysisA').value=String(sourceId);
    await showSuggestions();
  }
});

loadAll().catch(e=>notify(e.message,'danger'));
