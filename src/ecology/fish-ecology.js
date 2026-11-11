import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { applySwimMaterial, updateSwimUniforms } from './polyfish-swim-material.js';
import { calculateAquaticAcceleration, constrainFishDepth } from './aquatic-physics.js';

/**
 * Native Ultra-Water ecosystem. Agent state is authoritative; meshes are views.
 * Compact evolutionary/ecological model for interactive simulation, not a validated
 * marine-ecology research model.
 */
export class FishEcology {
  constructor(THREE, scene, options = {}) {
    this.T=THREE; this.scene=scene; this.rng=options.seed??0x51f15e;
    this.modelTemplate=options.modelTemplate??null; this.modelAnimations=options.modelAnimations??[]; this.modelCatalog=options.modelCatalog??[]; this.modelBudget=options.modelBudget??14; this.modelInstances=0; this.scaleMultiplier=options.scaleMultiplier??2.3;
    this.modelLoaded=Boolean(this.modelCatalog.some(item=>item.scene)||this.modelTemplate);
    this.params={population:110,worldRadius:42,minDepth:3,maxDepth:26,neighbourRadius:16,
      separationRadius:5,maxAcceleration:5,resourceCount:180,resourceRegrowth:.035,
      feedingRate:.22,reproductionEnergy:.82,reproductionCooldown:28,mutationRate:.08,
      mutationStrength:.12,predationRate:.7,predationThreshold:.7,currentStrength:.55,waterDensity:1025,dragCoefficient:.82,gravity:9.81,
      temperatureGradient:.45,oxygenGradient:.3,historyInterval:2,...options,...options.params};
    this.fish=[];this.resources=[];this.history=[];this.elapsed=0;this.nextId=0;this.updateCount=0;this.lastUpdateDt=0;this.lastUpdateElapsed=0;
    this.group=new THREE.Group();this.group.name='Ultra-Water Ecology';scene.add(this.group);
    this.mats=[0x65c8c8,0xe7b75c,0x8b9ee8,0xb6d58b,0xe58c80,0x9aadd1].map(color=>new THREE.MeshStandardMaterial({color,roughness:.5}));
    this.bodyGeo=new THREE.SphereGeometry(1,16,10);this.tailGeo=new THREE.ConeGeometry(.42,.8,4);this.finGeo=new THREE.ConeGeometry(.18,.55,3);
    this.eyeGeo=new THREE.SphereGeometry(.075,6,5);this.foodGeo=new THREE.SphereGeometry(.22,6,5);
    this.foodMat=new THREE.MeshBasicMaterial({color:0x8be2a0});
    this.populate(this.params.population);this.seedResources(this.params.resourceCount);
  }
  rand(){let x=this.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x|0;return(x>>>0)/4294967296;}
  range(a,b){return a+this.rand()*(b-a);}
  clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  chooseSpecies(){
    if(!this.modelCatalog.length)return Math.floor(this.rand()*this.mats.length);
    const total=this.modelCatalog.reduce((sum,item)=>sum+Math.max(0,item.weight??1),0);
    let pick=this.rand()*Math.max(total,1e-9);
    for(let i=0;i<this.modelCatalog.length;i++){pick-=Math.max(0,this.modelCatalog[i].weight??1);if(pick<=0)return i;}
    return this.modelCatalog.length-1;
  }
  genes(parent,mate=null){
    const ranges={speed:[1.2,7,3.4],size:[.45,1.8,1],metabolism:[.35,1.5,.8],sensoryRange:[7,34,18],
      cohesion:[0,1.8,.7],alignment:[0,1.8,.8],separation:[.2,2.2,1.1],aggression:[0,1,.25],
      sociality:[0,1,.5],kinAffinity:[0,1,.5],camouflage:[0,1,.5],feedingSpecialisation:[0,1,.5],fertility:[.2,1.4,.8],
      curiosity:[0,1,.5],boldness:[0,1,.5],leadership:[0,1,.5],affiliation:[0,1,.5],buoyancy:[0,1,.5]};
    const g={};for(const [k,[lo,hi,d]] of Object.entries(ranges)){
      let v=parent?(mate?(parent.genes[k]+mate.genes[k])*.5:parent.genes[k]):this.range(lo,hi);
      if(parent&&this.rand()<this.params.mutationRate)v+=this.range(-1,1)*(hi-lo)*this.params.mutationStrength;
      g[k]=this.clamp(v,lo,hi);
    }return g;
  }
  makeFish(parent=null,mate=null){
    const T=this.T,species=parent?.species??this.chooseSpecies(),modelEntry=this.modelCatalog[species]??null,g=this.genes(parent,mate),brain=Array.from({length:12},(_,i)=>{
      const v=parent?(mate?(parent.brain[i]+mate.brain[i])*.5:parent.brain[i]):this.range(-1,1);
      return this.clamp(v+(parent&&this.rand()<this.params.mutationRate?this.range(-.35,.35):0),-2,2);
    });
    if(!parent&&modelEntry?.role==='predator'){g.aggression=Math.max(g.aggression,.78);g.size=Math.max(g.size,1.25);}
    const root=new T.Group(),mat=this.mats[species%this.mats.length];let tail=null,mixer=null,swimData=null;
    const modelTemplate=modelEntry?.detail===false?this.modelTemplate:(modelEntry?.scene??this.modelTemplate);
    const modelAnimations=modelEntry?.detail===false?this.modelAnimations:(modelEntry?.animations?.length?modelEntry.animations:this.modelAnimations);
    const useModel=Boolean(modelTemplate&&this.modelInstances<this.modelBudget);
    let surfaceClearance = 1.35 * g.size;
    if(useModel){
      this.modelInstances++;
      const visual=cloneSkeleton(modelTemplate);
      const fishTint=new T.Color().setHSL(((g.hue%360)+360)%360/360,.72,.52);
      visual.traverse(child=>{if((child.isMesh||child.isSkinnedMesh)&&child.material){child.material=Array.isArray(child.material)?child.material.map(m=>m.clone()):child.material.clone();const mats=Array.isArray(child.material)?child.material:[child.material];for(const material of mats){if(material.color)material.color.multiplyScalar(1.18);if(material.emissive){material.emissive.copy(fishTint).multiplyScalar(.12);material.emissiveIntensity=.75;}}}});
      visual.updateMatrixWorld(true);
      const rawSize=new T.Box3().setFromObject(visual).getSize(new T.Vector3());
      const longest=rawSize.x>=rawSize.z&&rawSize.x>=rawSize.y?'x':rawSize.z>=rawSize.y?'z':'y';
      if(longest==='z')visual.rotation.y=Math.PI/2;
      else if(longest==='y')visual.rotation.z=-Math.PI/2;
      visual.updateMatrixWorld(true);
      const bounds=new T.Box3().setFromObject(visual),extent=bounds.getSize(new T.Vector3());
      visual.scale.setScalar((2.3*g.size*(modelEntry?.scale??1))/Math.max(extent.x,extent.y,extent.z,1e-6));
      visual.updateMatrixWorld(true);
      const visualBounds = new T.Box3().setFromObject(visual);
      const visualSize = visualBounds.getSize(new T.Vector3());
      surfaceClearance = visualSize.length() * 0.5;
      visual.position.sub(visualBounds.getCenter(new T.Vector3()));
      root.add(visual);
      if(modelAnimations.length){
        mixer=new T.AnimationMixer(visual);
        const swimClip=modelAnimations.find(clip=>/swim|idle/i.test(clip.name))??modelAnimations[0];
        mixer.clipAction(swimClip).play();
      }else swimData=applySwimMaterial(visual,'fish');
    }else{
      const body=new T.Mesh(this.bodyGeo,mat);const morph=[1,.82,1.22,.92,1.08,.72][species];body.scale.set(1.15*g.size*morph,.48*g.size*(species===2?1.25:1),.34*g.size*(species===4?1.35:1));root.add(body);
      tail=new T.Mesh(this.tailGeo,mat);tail.rotation.z=Math.PI/2;tail.position.x=-1.02*g.size*morph;tail.scale.set(.72*g.size,.62*g.size,.28*g.size);root.add(tail);
      const dorsal=new T.Mesh(this.finGeo,mat);dorsal.position.set(-.05*g.size,.43*g.size,0);dorsal.rotation.z=Math.PI/2;dorsal.scale.set(.8*g.size,.8*g.size,.55*g.size);root.add(dorsal);
      for(const side of [-1,1]){const fin=new T.Mesh(this.finGeo,mat);fin.position.set(.05*g.size,-.08*g.size,side*.24*g.size);fin.rotation.set(side*.5,0,Math.PI*.72);fin.scale.set(.48*g.size,.48*g.size,.35*g.size);root.add(fin);}
      for(const side of [-1,1]){const eye=new T.Mesh(this.eyeGeo,new T.MeshBasicMaterial({color:0x07151b}));eye.position.set(.38*g.size,.12*g.size,side*.245*g.size);root.add(eye);}
    }
    const p=parent?.root.position;
    const preferredDepth=parent?this.clamp(parent.preferredDepth+this.range(-1.5,1.5),this.params.minDepth+1,this.params.maxDepth-1):this.range(this.params.minDepth+1,this.params.maxDepth-1);
    root.position.set(p?p.x+this.range(-2,2):this.range(-this.params.worldRadius*.7,this.params.worldRadius*.7),
      p?p.y+this.range(-1,1):-preferredDepth-(surfaceClearance??0),
      p?p.z+this.range(-2,2):this.range(-this.params.worldRadius*.7,this.params.worldRadius*.7));
    this.group.add(root);const heading=new T.Vector3(this.rand()-.5,this.range(-.15,.15),this.rand()-.5).normalize();
    const role=g.leadership>.72&&g.sociality>.55?'leader':g.curiosity>.72?'scout':g.affiliation>.72?'shoaler':g.aggression>.72&&g.boldness>.55?'hunter':g.feedingSpecialisation>.72?'forager':g.boldness<.25?'shy':'generalist';
    return{id:this.nextId++,surfaceClearance:surfaceClearance??1.35*g.size,parentId:parent?.id??null,species,speciesName:modelEntry?.name??`shoal-fish-${species}`,sizeClass:modelEntry?.sizeClass??'shoal',ecologicalRole:modelEntry?.role??'generalist',root,tail,mixer,swimData,swimPhase:this.range(0,Math.PI*2),role,genes:g,brain,heading,memory:{foodPosition:new T.Vector3(),foodTtl:0,threatPosition:new T.Vector3(),threatTtl:0},
      velocity:heading.clone().multiplyScalar(g.speed*.5),preferredDepth,energy:parent?parent.energy*.45:this.range(.7,1),
      age:0,cooldown:0,phase:this.rand()*Math.PI*2,generation:parent?parent.generation+1:0,offspring:0,eaten:0,modelled:useModel};
  }
  populate(n){n=this.clamp(Math.round(n),0,500);while(this.fish.length<n)this.fish.push(this.makeFish());while(this.fish.length>n){const f=this.fish.pop();this.group.remove(f.root);if(f.modelled)this.modelInstances=Math.max(0,this.modelInstances-1);}this.params.population=n;}
  seedResources(n){n=this.clamp(Math.round(n),0,1200);while(this.resources.length<n){const mesh=new this.T.Mesh(this.foodGeo,this.foodMat);mesh.position.set(this.range(-this.params.worldRadius,this.params.worldRadius),-this.range(this.params.minDepth,this.params.maxDepth),this.range(-this.params.worldRadius,this.params.worldRadius));this.group.add(mesh);this.resources.push({mesh,biomass:1,respawn:0});}while(this.resources.length>n)this.group.remove(this.resources.pop().mesh);this.params.resourceCount=n;}
  environmentAt(p,surfaceY=0){
    const depth=Math.max(0,surfaceY-p.y),light=Math.exp(-depth/22);
    const temperature=.5+.5*Math.sin(p.x*.012)*this.params.temperatureGradient;
    const oxygen=this.clamp(.72+.22*Math.cos(p.z*.018)-depth*.008*this.params.oxygenGradient,.08,1);
    const nutrient=this.clamp(.45+.35*Math.sin(p.x*.025+p.z*.018),.05,1);
    const shear=Math.exp(-depth/38);
    const current=new this.T.Vector3(Math.sin(p.z*.018+this.elapsed*.12),Math.sin(p.x*.014+this.elapsed*.08)*.045,Math.cos(p.x*.016+this.elapsed*.1)).multiplyScalar(this.params.currentStrength*shear);
    return{depth,light,temperature,oxygen,nutrient,current};
  }
  nearestResource(p,r){let best=null,dmin=r*r;for(const x of this.resources)if(x.biomass>.02){const d=p.distanceToSquared(x.mesh.position);if(d<dmin){best=x;dmin=d;}}return best;}
  spatial(){const cell=Math.max(4,this.params.neighbourRadius),bins=new Map();for(const f of this.fish){const p=f.root.position,k=`${Math.floor(p.x/cell)},${Math.floor(p.y/cell)},${Math.floor(p.z/cell)}`;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(f);}return{bins,cell};}
  update(dt,elapsed=0,waterHeight=0){
    if(!Number.isFinite(dt)||dt<=0)return;const T=this.T,step=Math.min(dt,1/20);this.elapsed=elapsed;const localSurface=waterHeight-this.group.position.y;this.updateCount++;this.lastUpdateDt=step;this.lastUpdateElapsed=elapsed;
    const{bins,cell}=this.spatial(),r2=this.params.neighbourRadius**2,s2=this.params.separationRadius**2;
    this.lastSurfaceY=localSurface;
    const births=[],deaths=new Set();
    for(const f of this.fish){
      const p=f.root.position,cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell),cz=Math.floor(p.z/cell);
      const coh=new T.Vector3(),ali=new T.Vector3(),sep=new T.Vector3();let count=0,mate=null,prey=null,threat=null,leader=null,preyDistance=Infinity,threatDistance=Infinity;
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
        const bin=bins.get(`${cx+x},${cy+y},${cz+z}`);if(!bin)continue;
        for(const o of bin){if(o===f)continue;const d=o.root.position.clone().sub(p),d2=d.lengthSq();if(d2<1e-8||d2>Math.max(r2,f.genes.sensoryRange**2))continue;
          if(d2<=r2){count++;coh.add(o.root.position);ali.add(o.velocity);}
          if(d2<s2)sep.addScaledVector(d,-1/d2);
          const ratio=o.genes.size/f.genes.size;
          if(ratio>1.25&&o.genes.aggression>.55&&d2<90&&d2<threatDistance){threat=o;threatDistance=d2;}
          if(o.genes.leadership>f.genes.leadership+.2&&o.genes.sociality>.45&&d2<100&&(!leader||o.genes.leadership>leader.genes.leadership))leader=o;
          const kin=o.id===f.parentId||o.parentId===f.id||(f.parentId!==null&&o.parentId===f.parentId);
          if(!kin&&f.genes.aggression>this.params.predationThreshold&&ratio<.72&&d2<64&&d2<preyDistance){prey=o;preyDistance=d2;}
          if(!mate&&ratio>.8&&ratio<1.25&&d2<16&&o.energy>.55)mate=o;
        }
      }
      const env=this.environmentAt(p,localSurface),steer=new T.Vector3(),food=this.nearestResource(p,f.genes.sensoryRange),w=f.brain;
      if(count){coh.multiplyScalar(1/count).sub(p).normalize().multiplyScalar(f.genes.cohesion);ali.multiplyScalar(1/count).normalize().multiplyScalar(f.genes.alignment);steer.add(coh).add(ali).addScaledVector(sep,f.genes.separation);}
      if(food){f.memory.foodPosition.copy(food.mesh.position);f.memory.foodTtl=10;steer.addScaledVector(food.mesh.position.clone().sub(p).normalize(),w[0]*(.15+f.genes.feedingSpecialisation));}
      else if(f.memory.foodTtl>0){f.memory.foodTtl=Math.max(0,f.memory.foodTtl-step);steer.addScaledVector(f.memory.foodPosition.clone().sub(p).normalize(),w[0]*.08);}
      if(threat){f.memory.threatPosition.copy(threat.root.position);f.memory.threatTtl=6;}
      else f.memory.threatTtl=Math.max(0,f.memory.threatTtl-step);
      if(leader&&f.role!=='leader'){steer.addScaledVector(leader.root.position.clone().sub(p).normalize(),f.genes.affiliation*.24);steer.addScaledVector(leader.velocity.clone().normalize(),f.genes.affiliation*.12);}
      if(f.role==='scout')steer.add(new T.Vector3(Math.cos(f.phase+elapsed*.17),0,Math.sin(f.phase+elapsed*.17)).multiplyScalar(f.genes.curiosity*.18));
      steer.addScaledVector(env.current,w[1]*.22);
      steer.y+=w[2]*(env.oxygen-.5)+w[3]*(env.temperature-.5);
      steer.addScaledVector(coh.clone().normalize(),w[4]*f.genes.sociality*.25);
      steer.addScaledVector(sep.clone().normalize(),w[5]*.18);
      steer.addScaledVector(new T.Vector3(0,env.light-.5,0),w[6]*.12);
      steer.addScaledVector(new T.Vector3(-p.x,0,-p.z).normalize(),w[7]*.08);
      steer.addScaledVector(food?food.mesh.position.clone().sub(p).normalize():new T.Vector3(),w[8]*.12);
      steer.y+=w[9]*(env.nutrient-.5)*.08;
      steer.addScaledVector(env.current,w[10]*.08);
      steer.addScaledVector(new T.Vector3(0,env.oxygen-.5,0),w[11]*.08);
      if(threat)steer.addScaledVector(p.clone().sub(threat.root.position).normalize(),1.2+2.2*(1-f.genes.boldness));
      else if(f.memory.threatTtl>0)steer.addScaledVector(p.clone().sub(f.memory.threatPosition).normalize(),(1-f.genes.boldness)*.18);
      if(prey)steer.addScaledVector(prey.root.position.clone().sub(p).normalize(),1.2*f.genes.aggression);
      if(Math.hypot(p.x,p.z)>this.params.worldRadius)steer.add(new T.Vector3(-p.x,0,-p.z).normalize().multiplyScalar(2));
      if(p.y>localSurface-this.params.minDepth)steer.y-=1.2;if(p.y<localSurface-this.params.maxDepth)steer.y+=1.2;
      steer.y+=Math.sin(elapsed*.35+f.phase)*.06;if(steer.lengthSq())f.velocity.addScaledVector(steer.normalize(),this.params.maxAcceleration*step);
      const speed=f.velocity.length(),target=f.genes.speed*(.58+f.energy*.42);
      if(speed>1e-6)f.velocity.multiplyScalar(T.MathUtils.damp(speed,target,1.8,step)/speed);
      const fluidAcceleration=calculateAquaticAcceleration({velocity:f.velocity,waterVelocity:env.current,positionY:p.y,surfaceY:localSurface,preferredDepth:f.preferredDepth,bodySize:f.genes.size,waterDensity:this.params.waterDensity,bodyDensity:1025-(f.genes.buoyancy-.5)*14,dragCoefficient:this.params.dragCoefficient,gravity:this.params.gravity});
      f.velocity.add(new T.Vector3(fluidAcceleration.x,fluidAcceleration.y,fluidAcceleration.z).multiplyScalar(step));
      p.addScaledVector(f.velocity,step);constrainFishDepth(p,f.velocity,localSurface,this.params.minDepth,this.params.maxDepth,f.surfaceClearance??0);
      f.age+=step;f.cooldown=Math.max(0,f.cooldown-step);f.energy-=f.genes.metabolism*step*.0018+Math.max(0,.55-env.oxygen)*step*.003;
      if(food&&p.distanceTo(food.mesh.position)<1.8&&food.biomass>0){const bite=Math.min(food.biomass,this.params.feedingRate*step*8);food.biomass-=bite;f.energy=Math.min(1.5,f.energy+bite*.8);f.eaten+=bite;food.mesh.scale.setScalar(Math.max(.08,food.biomass));if(food.biomass<=.02)food.respawn=this.range(8,22);}
      if(f.energy>this.params.reproductionEnergy&&f.cooldown<=0&&mate&&f.id<mate.id&&this.fish.length+births.length<500){births.push(this.makeFish(f,mate));f.energy*=.62;mate.energy*=.92;f.cooldown=mate.cooldown=this.params.reproductionCooldown/f.genes.fertility;f.offspring++;mate.offspring++;}
      if(prey&&p.distanceTo(prey.root.position)<1.1&&f.energy<1.2&&this.rand()<this.params.predationRate*step*2){f.energy=Math.min(1.5,f.energy+prey.genes.size*.42);f.eaten+=prey.genes.size;deaths.add(prey);}
      if(f.energy<=.08||f.age>1800)deaths.add(f);
      f.heading.copy(f.velocity).normalize();if(f.heading.lengthSq())f.root.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),f.heading);
      if(f.tail)f.tail.rotation.y=Math.sin(elapsed*(5+f.genes.speed)+f.phase)*.55;
      if(f.mixer)f.mixer.update(step);
      if(f.swimData){f.swimPhase+=step*(4+f.genes.speed*.4);updateSwimUniforms(f.swimData,f.swimPhase,.8,f.energy<.3);}
    }
    for(const f of deaths){this.group.remove(f.root);if(f.modelled)this.modelInstances=Math.max(0,this.modelInstances-1);}this.fish=this.fish.filter(f=>!deaths.has(f)).concat(births);
    for(const r of this.resources){if(r.biomass<=.02){r.respawn-=step;if(r.respawn<=0){r.biomass=1;r.mesh.scale.setScalar(1);}}else{const e=this.environmentAt(r.mesh.position,localSurface);r.biomass=Math.min(1,r.biomass+this.params.resourceRegrowth*e.nutrient*e.light*(.5+e.oxygen*.5)*step);}}
    if(elapsed-(this.history.at(-1)?.time??-this.params.historyInterval)>=this.params.historyInterval)this.recordHistory(elapsed);
  }
  recordHistory(time){const n=this.fish.length,avg=k=>n?this.fish.reduce((s,f)=>s+(f.genes[k]??f[k]??0),0)/n:0;this.history.push({time,population:n,resources:this.resources.reduce((s,r)=>s+r.biomass,0),meanSize:avg('size'),meanSpeed:avg('speed'),meanAggression:avg('aggression'),meanMetabolism:avg('metabolism'),meanEnergy:avg('energy'),meanGeneration:avg('generation')});if(this.history.length>1800)this.history.shift();}
  getStats(){const n=this.fish.length,avg=k=>n?this.fish.reduce((s,f)=>s+(f.genes[k]??f[k]??0),0)/n:0,roles={},species={};for(const f of this.fish){roles[f.role]=(roles[f.role]??0)+1;species[f.speciesName]=(species[f.speciesName]??0)+1;}return{population:n,species,speciesModelCount:this.modelCatalog.filter(item=>item.scene).length,resources:this.resources.reduce((s,r)=>s+r.biomass,0),meanSpeed:avg('speed'),meanSize:avg('size'),meanAggression:avg('aggression'),meanMetabolism:avg('metabolism'),meanEnergy:avg('energy'),meanGeneration:avg('generation'),roles,modelLoaded:this.modelLoaded,history:this.history};}
  dispose(){this.scene.remove(this.group);for(const m of this.mats)m.dispose();this.foodMat.dispose();this.bodyGeo.dispose();this.tailGeo.dispose();this.eyeGeo.dispose();this.foodGeo.dispose();}
}
