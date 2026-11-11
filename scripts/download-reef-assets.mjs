import fs from 'node:fs/promises';
import path from 'node:path';

const destination=path.resolve(process.argv[2]||'_upstream/ultra-water/public/models/osmocean/reef');
const assets=['rock_moss_set_01','rock_moss_set_02'];
const headers={'User-Agent':'Osmocean-Reef-Asset-Pipeline/1.0 (+https://github.com/gemquota/osmocean)'};
async function json(url){const r=await fetch(url,{headers});if(!r.ok)throw new Error('Poly Haven API '+r.status+' '+url);return r.json();}
async function save(url,file){const r=await fetch(url,{headers});if(!r.ok)throw new Error('Poly Haven asset download '+r.status+' '+url);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,Buffer.from(await r.arrayBuffer()));}
async function main(){
  await fs.mkdir(destination,{recursive:true});
  for(const id of assets){
    const tree=await json('https://api.polyhaven.com/files/'+id);
    const model=tree?.modelFiles?.gltf?.['1k']?.gltf??tree?.gltf?.['1k']?.gltf;
    if(!model?.url)throw new Error('No 1K glTF found for '+id);
    const folder=path.join(destination,id);await fs.mkdir(folder,{recursive:true});
    await save(model.url,path.join(folder,id+'.gltf'));
    for(const [relative,dep] of Object.entries(model.include??{})){
      if(!dep?.url)continue;
      const safe=path.normalize(relative).replace(/^([.][.][/\\\\])+/, '');
      await save(dep.url,path.join(folder,safe));
    }
    // Keep each model's referenced buffers and textures beside its glTF.
    const entries=await fs.readdir(folder,{recursive:true});
    for(const relative of entries){const from=path.join(folder,relative);const stat=await fs.stat(from).catch(()=>null);if(!stat?.isFile())continue;const to=path.join(destination,relative);await fs.mkdir(path.dirname(to),{recursive:true});await fs.rename(from,to);}
    await fs.rm(folder,{recursive:true,force:true});
    console.log('Downloaded Poly Haven CC0 model: '+id);
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
