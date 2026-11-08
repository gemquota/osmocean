const canvas = document.querySelector('#flow');
const ctx = canvas.getContext('2d');
const strength = document.querySelector('#strength');
const curl = document.querySelector('#curl');
const strengthValue = document.querySelector('#strength-value');
const curlValue = document.querySelector('#curl-value');
const toggle = document.querySelector('#toggle');
const reset = document.querySelector('#reset');
const count = document.querySelector('#particle-count');
let width = 0, height = 0, running = true, frame = 0, particles = [];
const TAU = Math.PI * 2;
const rand = (min,max) => min + Math.random() * (max-min);
function resize(){
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  width = rect.width; height = rect.height;
  canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(!particles.length) seed(); else particles.forEach(p=>{p.x%=width;p.y%=height});
}
function seed(){
  particles = Array.from({length:Math.max(180,Math.min(520,Math.floor(width*height/1050)))},()=>({x:rand(0,width),y:rand(0,height),age:rand(0,1),life:rand(180,520),speed:rand(.65,1.35)}));
  count.textContent = String(particles.length).padStart(3,'0')+' PARTICLES';
}
function velocity(x,y,t){
  const s = Number(strength.value), c = Number(curl.value);
  const nx=x/Math.max(width,1), ny=y/Math.max(height,1);
  const a=Math.sin(ny*TAU*1.45+t*.00028)*.7 + Math.cos(nx*TAU*.8-t*.00019)*.35;
  const b=Math.cos(nx*TAU*1.2+t*.00022)*.55 + Math.sin(ny*TAU*.7+t*.00017)*.25;
  const dx=x-width*.53, dy=y-height*.51, r2=dx*dx+dy*dy+12000;
  return {x:(.72+a*.48)*s + (-dy/r2)*c*21000, y:(b*.55)*s+(dx/r2)*c*21000};
}
function draw(t){
  ctx.fillStyle='rgba(5,19,28,.19)';ctx.fillRect(0,0,width,height);
  // Sparse field guides show direction without pretending to be a solver grid.
  ctx.strokeStyle='rgba(101,198,208,.055)';ctx.lineWidth=1;
  for(let x=0;x<width;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}
  for(let y=0;y<height;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
  for(const p of particles){
    const v=velocity(p.x,p.y,t), px=p.x,py=p.y;
    p.x+=v.x*p.speed*.38;p.y+=v.y*p.speed*.38;p.age++;
    if(p.x<0||p.x>width||p.y<0||p.y>height||p.age>p.life){p.x=rand(0,width);p.y=rand(0,height);p.age=0;p.life=rand(180,520)}
    const alpha=.18 + .62*(1-p.age/p.life);
    ctx.strokeStyle='rgba(140,230,202,'+alpha+')';ctx.lineWidth=.8+(1-p.age/p.life)*.6;
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+(p.x-px)*3.2,py+(p.y-py)*3.2);ctx.stroke();
  }
  frame=requestAnimationFrame(draw);
}
strength.addEventListener('input',()=>strengthValue.value=Number(strength.value).toFixed(1)+'×');
curl.addEventListener('input',()=>curlValue.value=Number(curl.value).toFixed(2));
toggle.addEventListener('click',()=>{running=!running;toggle.textContent=running?'Ⅱ  PAUSE':'▶  RESUME';if(running)frame=requestAnimationFrame(draw);else cancelAnimationFrame(frame)});
reset.addEventListener('click',()=>{seed();ctx.clearRect(0,0,width,height)});
new ResizeObserver(resize).observe(canvas);
resize();frame=requestAnimationFrame(draw);