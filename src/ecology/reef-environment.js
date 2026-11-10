/**
 * Static reef habitat for the underwater ecology scene.
 * Procedural low-poly forms keep the habitat self-contained and mobile friendly.
 */
export function createReef(THREE, parent, seed = 0x71ef, density = 1) {
  let state = seed >>> 0;
  const rand = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const group = new THREE.Group(); group.name = 'Coral reef habitat'; parent.add(group);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x536a68, roughness: 1 });
  const rockLight = new THREE.MeshStandardMaterial({ color: 0x71817a, roughness: .95 });
  const coralMats = [0xe87568,0xf0a65c,0x9b83c8,0xe6c66d,0x55b9a3,0xd77aa7].map(color => new THREE.MeshStandardMaterial({color,roughness:.72}));
  const algaeMat = new THREE.MeshStandardMaterial({color:0x4c9274,roughness:.9,side:THREE.DoubleSide});
  const spongeMat = new THREE.MeshStandardMaterial({color:0xe3a34f,roughness:.85});
  const rockGeo = new THREE.IcosahedronGeometry(1,1), coralGeo = new THREE.CylinderGeometry(.08,.2,1,5), plateGeo = new THREE.CylinderGeometry(.1,.18,.12,8);
  const floor = new THREE.Group(); floor.position.y = -23; group.add(floor);
  for (let i=0;i<Math.round(34*density);i++) {
    const a=rand()*Math.PI*2,r=5+rand()*31,s=1.8+rand()*4.8,rock=new THREE.Mesh(rockGeo,rand()>.55?rockMat:rockLight);
    rock.position.set(Math.cos(a)*r,rand()*2.4,Math.sin(a)*r);rock.scale.set(s*(.8+rand()),s*(.45+rand()*.55),s*(.8+rand()));
    rock.rotation.set(rand()*Math.PI,rand()*Math.PI,rand()*Math.PI);rock.castShadow=true;rock.receiveShadow=true;floor.add(rock);
  }
  for(let i=0;i<Math.round(52*density);i++){
    const a=rand()*Math.PI*2,r=4+rand()*29,x=Math.cos(a)*r,z=Math.sin(a)*r,kind=Math.floor(rand()*4),mat=coralMats[Math.floor(rand()*coralMats.length)];
    const head=new THREE.Group();head.position.set(x,1+rand()*1.4,z);floor.add(head);
    if(kind===0){for(let b=0;b<5;b++){const h=1.4+rand()*3.8,branch=new THREE.Mesh(coralGeo,mat);branch.position.set((rand()-.5)*1.2,h*.42,(rand()-.5)*1.2);branch.scale.set(.7,h,.7);branch.rotation.z=(rand()-.5)*.65;branch.rotation.x=(rand()-.5)*.55;head.add(branch);}}
    else if(kind===1){for(let b=0;b<3;b++){const plate=new THREE.Mesh(plateGeo,mat);plate.position.y=b*.7;plate.scale.set(1+rand()*1.4,1,1+rand()*1.4);head.add(plate);}}
    else if(kind===2){const fan=new THREE.Mesh(new THREE.SphereGeometry(1,8,6,0,Math.PI*2,0,Math.PI*.55),mat);fan.scale.set(1.8,2.8,.22);fan.position.y=1.7;head.add(fan);for(let k=0;k<4;k++){const rib=new THREE.Mesh(coralGeo,mat);rib.position.set((k-1.5)*.55,1.8,.02);rib.scale.set(.16,3,.16);rib.rotation.z=(k-1.5)*.22;head.add(rib);}}
    else {for(let b=0;b<4;b++){const tube=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,1.6+rand()*1.8,7),spongeMat);tube.position.set((rand()-.5)*1.3,.8,(rand()-.5)*1.3);head.add(tube);}}
  }
  const bladeGeo=new THREE.PlaneGeometry(.55,4,1,5);
  for(let i=0;i<Math.round(90*density);i++){const a=rand()*Math.PI*2,r=7+rand()*28,stem=new THREE.Mesh(bladeGeo,algaeMat);stem.position.set(Math.cos(a)*r,-1.3+rand()*1.2,Math.sin(a)*r);stem.rotation.set((rand()-.5)*.45,rand()*Math.PI,(rand()-.5)*.4);stem.scale.set(.55+rand()*.8,.5+rand()*.9,1);floor.add(stem);}
  return {group,dispose(){group.parent?.remove(group);for(const m of [rockMat,rockLight,...coralMats,algaeMat,spongeMat])m.dispose();rockGeo.dispose();coralGeo.dispose();plateGeo.dispose();bladeGeo.dispose();}};
}
