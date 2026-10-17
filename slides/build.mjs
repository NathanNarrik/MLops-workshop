// Authoring-only utility. The workshop application does not depend on Node.js.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const root = process.cwd();
const build = path.join(root, '.work', 'deck');
const source = path.join(root, 'slides', 'assets', 'theme.pptx');
const skill = process.env.PRESENTATION_SKILL_DIR;
const python = process.env.PRESENTATION_PYTHON;
if (!skill || !python) throw new Error('Set PRESENTATION_SKILL_DIR and PRESENTATION_PYTHON');
await fs.mkdir(build, { recursive: true });
const content = JSON.parse(await fs.readFile('slides/content.json', 'utf8'));
const p = await PresentationFile.importPptx(await FileBlob.load(source));
const template = p.slides.items[0];
const templateRecords=(await p.inspect({kind:'textbox,shape,image',maxChars:100000})).ndjson.split('\n').filter(Boolean).map(JSON.parse);
p.delete(templateRecords.filter(r=>r.editable!==false && /^(sh|im)\//.test(r.id)).map(r=>r.id));
const pink = '#CA2352', blue = '#3A64E4', white = '#FFFFFF', muted = '#B8C4CC';

function text(slide, value, x, y, w, h, size = 26.667, color = white, bold = false, align = 'left') {
  const shape = slide.shapes.add({geometry:'textbox', name:value.slice(0,60),
    position:{left:x,top:y,width:w,height:h}, fill:'none', line:{fill:'none',width:0}});
  shape.text = value;
  shape.text.style = {typeface:'Space Grotesk',fontSize:size,color,bold,alignment:align};
  shape.text.insets = 0;
  return shape;
}
function title(s,t){text(s,t,48,46,864,100,37.333,white,true);}
function detail(s,t){if(t)text(s,t,48,438,750,47,20,muted);}
function items(s,arr,x,y,w,color=white){arr.forEach((v,i)=>text(s,v,x,y+i*66,w,58,26.667,color));}
async function picture(s,file,x,y,w,h){
  const b=await fs.readFile(path.join(root,'slides/assets',file));
  s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',
    alt:'Screenshot of the working SoDA Digit Lab application',fit:'contain',position:{left:x,top:y,width:w,height:h}});
}

for (let index=0;index<content.length;index++){
  const d=content[index], s=template.duplicate();
  s.speakerNotes.text=d.notes;
  switch(d.type){
    case 'concept':
      title(s,d.title);
      text(s,d.label,48,153,864,42,25,pink,true);
      text(s,d.statement,48,218,864,158,32,white);
      detail(s,d.detail);
      break;
    case 'cover':
      text(s,d.subtitle,55,98,820,40,26.667,blue);
      text(s,d.title,55,172,850,150,50,white,true);
      text(s,d.detail,55,345,800,44,28,pink);
      text(s,'Train → Package → Deploy → Monitor',55,417,780,35,24,muted);
      break;
    case 'section':
      text(s,d.number,55,135,100,60,48,pink,true);
      text(s,d.title,55,215,800,85,56,white,true);
      text(s,d.subtitle,55,324,820,68,28,muted);
      break;
    case 'two':
      title(s,d.title);
      text(s,d.leftTitle,48,174,405,55,28,pink,true);
      text(s,d.rightTitle,505,174,405,55,28,blue,true);
      items(s,d.left,48,244,405);items(s,d.right,505,244,405);
      detail(s,d.detail);
      break;
    case 'flow':
      title(s,d.title);
      d.steps.forEach(([a,b],i)=>{
        const x=48+i*225;
        text(s,String(i+1).padStart(2,'0'),x,177,180,35,22,i%2?blue:pink);
        text(s,a,x,226,210,58,31,white,true);
        text(s,b,x,301,194,72,24,muted);
      });detail(s,d.detail);break;
    case 'image':
      title(s,d.title);await picture(s,d.image,48,136,864,290);
      detail(s,d.caption);break;
    case 'code':
      title(s,d.title);text(s,d.code,55,157,850,260,23,blue);
      detail(s,d.detail);break;
    case 'numbers':
      title(s,d.title);
      d.numbers.forEach(([value,label],i)=>{
        text(s,value,48+i*300,205,270,85,56,i===1?blue:pink,true);
        text(s,label,48+i*300,308,270,60,26.667,white);
      });detail(s,d.detail);break;
    case 'metric':
      title(s,d.title);text(s,d.value,48,167,850,120,94,pink,true);
      text(s,d.label,55,318,830,55,30,white);
      detail(s,d.detail);break;
    case 'exercise':
      title(s,d.title);text(s,d.code,48,155,864,60,24,blue);
      items(s,d.items,48,240,850);detail(s,d.detail);break;
    case 'rows':
      title(s,d.title);
      d.items.forEach(([a,b],i)=>{
        const y=156+i*66;
        text(s,a,48,y,290,58,25,i%2?blue:pink,true);
        text(s,b,355,y,550,58,25,white);
      });detail(s,d.detail);break;
    case 'closing':
      text(s,d.title,48,155,864,90,56,white,true,'center');
      text(s,d.subtitle,48,275,864,60,32,pink,false,'center');
      text(s,d.detail,48,375,864,40,26.667,muted,false,'center');break;
    default:throw new Error(`Unknown slide type: ${d.type}`);
  }
  text(s,String(index+1).padStart(2,'0'),48,501,60,22,14,muted);
}
p.slides.keep(p.slides.items.map((_,i)=>i).slice(1));
// Resolve the intended sequence using each slide's unique speaker notes.
const records=(await p.inspect({kind:'slide',maxChars:100000})).ndjson.split('\n').filter(Boolean).map(JSON.parse);
const order=content.map(d=>records.find(r=>p.slides.items[r.slideIndex].speakerNotes.text===d.notes).id);
p.slides.reorder(order);
const candidate=path.join(build,'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
for(let i=0;i<p.slides.items.length;i++){
  const s=p.slides.items[i];
  const png=await p.export({slide:s,format:'png',scale:1});
  await fs.writeFile(path.join(build,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(path.join(build,'montage.webp'),new Uint8Array(await (await p.export({format:'webp',montage:true,scale:.7})).arrayBuffer()));
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const finalPath=path.join(root,'slides',process.env.DECK_FILENAME || 'SoDA-MLOps-Workshop.pptx');
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath,
  pythonExecutable:python,
  integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','9144000,5143500','--validate-heading-fit'],
  fontPolicy:{basis:'reference',families:['Space Grotesk'],referencePath:source,
    referenceSha256:crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex')},
  requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],
  verifyArtifactToolImport:true,
  receiptPath:path.join(build,`${path.basename(finalPath)}.${Date.now()}.validation.json`)});
console.log(JSON.stringify({slides:p.slides.items.length,finalPath,result}));
