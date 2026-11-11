/**
 * Reef habitat with a sculpted seabed, grouped rock outcrops and coral zones.
 * Poly Haven models are CC0 and downloaded at build time; procedural fallback
 * geometry keeps the scene usable if an upstream asset is unavailable.
 */
export function createReef(THREE, parent, seed = 0x71ef, density = 1, options = {}) {
  let state = seed >>> 0;
  const rand = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const group = new THREE.Group(); group.name = 'Coral reef habitat'; parent.add(group);
  const floor = new THREE.Group(); floor.name = 'reef seabed'; floor.position.y = -23; group.add(floor);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x536a68, roughness: 1 });
  const rockLight = new THREE.MeshStandardMaterial({ color: 0x71817a, roughness: .95 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x465c59, roughness: 1, side: THREE.DoubleSide });
  const coralMats = [0xe87568,0xf0a65c,0x9b83c8,0xe6c66d,0x55b9a3,0xd77aa7].map(color => new THREE.MeshStandardMaterial({color,roughness:.72}));
  const algaeMat = new THREE.MeshStandardMaterial({color:0x4c9274,roughness:.9,side:THREE.DoubleSide});
  const spongeMat = new THREE.MeshStandardMaterial({color:0xe3a34f,roughness:.85});
  const rockGeo = new THREE.IcosahedronGeometry(1,1), coralGeo = new THREE.CylinderGeometry(.08,.2,1,5), plateGeo = new THREE.CylinderGeometry(.1,.18,.12,8);
  const terrainSize=42,segments=56,positions=[],indices=[],colors=[];
  const seabedHeight=(x,z)=>{
    const ridge=2.2*Math.exp(-Math.pow((z-7*Math.sin(x*.075))/4.5,2));
    const shelf=1.35*Math.exp(-Math.pow((Math.hypot(x+12,z-5)-15)/3.2,2));
    const trench=-3.8*Math.exp(-Math.pow((Math.hypot(x-8,z+10)-9)/3.1,2));
    const hummock=.7*Math.sin(x*.19+Math.sin(z*.12))*Math.cos(z*.17);
    return ridge+shelf+trench+hummock;
  };
  for(let iz=0;iz<=segments;iz++)for(let ix=0;ix<=segments;ix++){
    const x=(ix/segments*2-1)*terrainSize,z=(iz/segments*2-1)*terrainSize,y=seabedHeight(x,z);
    positions.push(x,y,z);const shade=THREE.MathUtils.clamp(.34+y*.025,.22,.52);colors.push(shade*.72,shade*.94,shade*.9);
    if(ix<segments&&iz<segments){const a=iz*(segments+1)+ix,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  const terrainGeo=new THREE.BufferGeometry();terrainGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainGeo.setIndex(indices);terrainGeo.computeVertexNormals();
  const terrain=new THREE.Mesh(terrainGeo,sandMat);terrain.name='sculpted seabed: ridges, shelf and trench';terrain.receiveShadow=true;floor.add(terrain);
  const rockTemplates=(options.rockTemplates??[]).filter(Boolean);
  const rockClusters=Math.round((rockTemplates.length?18:34)*density);
  for(let i=0;i<rockClusters;i++){
    const a=rand()*Math.PI*2,band=i%3===0?12+rand()*8:i%3===1?22+rand()*12:5+rand()*10,x=Math.cos(a)*band,z=Math.sin(a)*band;
    const cluster=new THREE.Group();cluster.name='boulder formation';cluster.position.set(x,seabedHeight(x,z),z);cluster.rotation.y=rand()*Math.PI*2;floor.add(cluster);
    const count=rockTemplates.length?2+Math.floor(rand()*3):2+Math.floor(rand()*4);
    for(let j=0;j<count;j++){
      const s=2.8+rand()*5.5,px=(rand()-.5)*s*1.5,pz=(rand()-.5)*s*1.5;
      if(rockTemplates.length){
        const model=rockTemplates[Math.floor(rand()*rockTemplates.length)].clone(true);model.name='Poly Haven CC0 rock asset instance';
        const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),scale=s/Math.max(size.x,size.y,size.z,1e-5);
        model.scale.setScalar(scale);model.position.set(px,s*.16+rand()*1.2,pz);model.rotation.y=rand()*Math.PI*2;
        model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
        cluster.add(model);
      }else{
        const rock=new THREE.Mesh(rockGeo,rand()>.55?rockMat:rockLight);rock.position.set(px,s*.35,pz);rock.scale.set(s*(.8+rand()),s*(.45+rand()*.55),s*(.8+rand()));rock.rotation.set(rand()*Math.PI,rand()*Math.PI,rand()*Math.PI);rock.castShadow=true;rock.receiveShadow=true;cluster.add(rock);
      }
    }
    if(i%4===0){const ledge=new THREE.Mesh(new THREE.BoxGeometry(7+rand()*5,1.4,3+rand()*2),rockLight);ledge.position.set(0,4.5,0);ledge.rotation.z=(rand()-.5)*.28;ledge.castShadow=true;ledge.receiveShadow=true;cluster.add(ledge);}
  }
  for(let i=0;i<Math.round(52*density);i++){
    const a=rand()*Math.PI*2,r=4+rand()*29,x=Math.cos(a)*r,z=Math.sin(a)*r,kind=Math.floor(rand()*4),mat=coralMats[Math.floor(rand()*coralMats.length)],head=new THREE.Group();
    head.position.set(x,seabedHeight(x,z)+.5+rand()*1.4,z);floor.add(head);
    if(kind===0){for(let b=0;b<5;b++){const h=1.4+rand()*3.8,branch=new THREE.Mesh(coralGeo,mat);branch.position.set((rand()-.5)*1.2,h*.42,(rand()-.5)*1.2);branch.scale.set(.7,h,.7);branch.rotation.z=(rand()-.5)*.65;branch.rotation.x=(rand()-.5)*.55;head.add(branch);}}
    else if(kind===1){for(let b=0;b<3;b++){const plate=new THREE.Mesh(plateGeo,mat);plate.position.y=b*.7;plate.scale.set(1+rand()*1.4,1,1+rand()*1.4);head.add(plate);}}
    else if(kind===2){const fan=new THREE.Mesh(new THREE.SphereGeometry(1,8,6,0,Math.PI*2,0,Math.PI*.55),mat);fan.scale.set(1.8,2.8,.22);fan.position.y=1.7;head.add(fan);for(let k=0;k<4;k++){const rib=new THREE.Mesh(coralGeo,mat);rib.position.set((k-1.5)*.55,1.8,.02);rib.scale.set(.16,3,.16);rib.rotation.z=(k-1.5)*.22;head.add(rib);}}
    else{for(let b=0;b<4;b++){const tube=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,1.6+rand()*1.8,7),spongeMat);tube.position.set((rand()-.5)*1.3,.8,(rand()-.5)*1.3);head.add(tube);}}
  }
  const bladeGeo=new THREE.PlaneGeometry(.55,4,1,5);
  for(let i=0;i<Math.round(90*density);i++){const a=rand()*Math.PI*2,r=7+rand()*28,x=Math.cos(a)*r,z=Math.sin(a)*r,stem=new THREE.Mesh(bladeGeo,algaeMat);stem.position.set(x,seabedHeight(x,z)-1.3+rand()*1.2,z);stem.rotation.set((rand()-.5)*.45,rand()*Math.PI,(rand()-.5)*.4);stem.scale.set(.55+rand()*.8,.5+rand()*.9,1);floor.add(stem);}
  return{group,floor,rockAssetCount:rockTemplates.length,dispose(){group.parent?.remove(group);for(const m of[rockMat,rockLight,sandMat,...coralMats,algaeMat,spongeMat])m.dispose();rockGeo.dispose();coralGeo.dispose();plateGeo.dispose();bladeGeo.dispose();terrainGeo.dispose();}};
}
