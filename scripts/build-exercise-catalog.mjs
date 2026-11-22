#!/usr/bin/env node
// Builds the Movement exercise catalog from the wger exercise database (AGPL-3.0 server,
// per-record CC-BY-SA 4 content). We import record-level metadata and the English
// instructions only, keep attribution per record, and package the short muscle banner
// images next to the JSON so the page never depends on a third-party host at runtime.
//
// Usage:
//   node scripts/build-exercise-catalog.mjs                 # pinned revision, network required
//   node scripts/build-exercise-catalog.mjs --offline       # re-derive catalog from existing snapshots
//
// Upstream revision is pinned. Re-running with a different revision must be an explicit
// product decision, never an accident of CI.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const outDir = path.join(repo, 'portal/data/movement');
const mediaDir = path.join(repo, 'portal/assets/movement/wger');
const PINNED = {
  upstream: 'wger.de/api/v2',
  project: 'wger Workout Manager',
  projectUrl: 'https://wger.de',
  repo: 'https://github.com/wger-project/wger',
  pinnedAt: '2026-10-25',
  userAgent: 'zero-one-movement-catalog/1.0 (+https://github.com/foxlongfei/zero-one-workbench)',
};
const OFFLINE = process.argv.includes('--offline');

// Movement identity: equipment or setting a real person actually has, nothing exotic.
const SELECTION = [
  {
    id: 1551, slug: 'push-up', zh: '标准俯卧撑', aliases: ['俯卧撑', '伏地挺身', 'push up', 'pushup', 'push-up'],
    family: '水平推', movement: 'flexion-extension', pattern: 'horizontal-push', side: 'bilateral',
    level: 'beginner', equipmentKey: 'bodyweight', environment: ['home', 'outdoor'], rig: 'push-up',
    teaching: { position: 'prone-support', description: '手掌与前脚掌撑地，身体从头到脚跟保持一条直线，胸、髋、踝在同一直线上。夹紧臀部与腹部，让骨盆不塌不撅。' },
  },
  {
    id: 1218, slug: 'knee-push-up', zh: '跪姿俯卧撑', aliases: ['跪姿俯卧撑', '膝盖俯卧撑', 'knee push up', 'modified push up'],
    family: '水平推', movement: 'flexion-extension', pattern: 'horizontal-push', side: 'bilateral',
    level: 'beginner', equipmentKey: 'bodyweight', environment: ['home', 'outdoor'], rig: 'knee-push-up',
    teaching: { position: 'kneeling-support', description: '膝盖着地、小腿抬起，膝到肩保持直线。手掌略宽于肩，臀部收紧，不要用腰部下坠代替屈肘。' },
  },
  {
    id: 713, slug: 'wall-push-up', zh: '墙面俯卧撑', aliases: ['墙面俯卧撑', '推墙', 'wall push up', 'push against wall'],
    family: '水平推', movement: 'flexion-extension', pattern: 'horizontal-push', side: 'bilateral',
    level: 'beginner', equipmentKey: 'bodyweight', environment: ['home', 'office'], rig: 'wall-push-up',
    teaching: { position: 'standing-support', description: '面对墙站立，双手与肩同宽撑在墙面约肩高，身体离墙约一臂距离并保持一条直线，屈肘靠近墙面再推回。' },
  },
  {
    id: 386, slug: 'diamond-push-up', zh: '钻石俯卧撑', aliases: ['钻石俯卧撑', '窄距俯卧撑', 'diamond push up', 'close grip push up', 'triangle push up'],
    family: '水平推', movement: 'flexion-extension', pattern: 'horizontal-push', side: 'bilateral',
    level: 'intermediate', equipmentKey: 'bodyweight', environment: ['home', 'outdoor'], rig: 'diamond-push-up',
    teaching: { position: 'prone-support', description: '双手在胸口中线下并拢，拇指与食指相触形成一个菱形。肘部贴近身体两侧，下降时不要让手掌外翻或耸肩。' },
  },
  {
    id: 1964, slug: 'wide-push-up', zh: '宽距俯卧撑', aliases: ['宽距俯卧撑', '宽手俯卧撑', 'wide push up', 'wide grip push up'],
    family: '水平推', movement: 'flexion-extension', pattern: 'horizontal-push', side: 'bilateral',
    level: 'intermediate', equipmentKey: 'bodyweight', environment: ['home', 'outdoor'], rig: 'wide-push-up',
    teaching: { position: 'prone-support', description: '手掌明显宽于肩，手指略外旋。下降时肩胛保持稳定、不耸肩，推起时感受胸部收紧。' },
  },
  {
    id: 1112, slug: 'decline-push-up', zh: '下斜俯卧撑', aliases: ['下斜俯卧撑', '脚高俯卧撑', '抬脚俯卧撑', 'decline push up', 'feet elevated push up'],
    family: '水平推', movement: 'flexion-extension', pattern: 'horizontal-push', side: 'bilateral',
    level: 'intermediate', equipmentKey: 'bodyweight', environment: ['home', 'outdoor'], rig: 'decline-push-up',
    teaching: { position: 'declined-prone-support', description: '双脚放在稳固台阶或床上，双手撑地。身体仍保持一条直线，不要为了降低难度把臀部抬高。' },
  },
  {
    id: 1293, slug: 'one-arm-push-up', zh: '单臂俯卧撑', aliases: ['单臂俯卧撑', '单手俯卧撑', 'one arm push up', 'one arm pushup'],
    family: '水平推', movement: 'flexion-extension', pattern: 'horizontal-push', side: 'unilateral',
    level: 'advanced', equipmentKey: 'bodyweight', environment: ['home', 'outdoor'], rig: 'one-arm-push-up',
    teaching: { position: 'one-handed-prone-support', description: '这是高难度进阶动作。双脚可以分开以降低扭转要求，核心和臀部必须主动收紧，躯干尽量少旋转。先具备标准俯卧撑与器械外负荷基础再尝试。' },
  },
  {
    id: 1963, slug: 'squat', zh: '徒手深蹲', aliases: ['深蹲', '徒手深蹲', 'squat', 'bodyweight squat', 'air squat'],
    family: '下肢蹲', movement: 'flexion-extension', pattern: 'squat', side: 'bilateral',
    level: 'beginner', equipmentKey: 'bodyweight', environment: ['home', 'outdoor', 'gym'], rig: 'squat',
    teaching: { position: 'standing', description: '双脚与肩同宽，脚尖略外展。髋部向后向下，膝盖顺着脚尖方向，躯干保持挺拔，下到大腿接近水平再站起。' },
  },
  {
    id: 984, slug: 'lunge', zh: '弓步', aliases: ['弓步', '箭步蹲', '前弓步', 'lunge', 'forward lunge'],
    family: '下肢分腿', movement: 'flexion-extension', pattern: 'lunge', side: 'alternating',
    level: 'beginner', equipmentKey: 'bodyweight', environment: ['home', 'outdoor', 'gym'], rig: 'lunge',
    teaching: { position: 'split-stance', description: '一脚向前迈出一步，两个膝盖都弯曲到接近直角，前膝与脚尖同向。后脚脚跟立起，躯干直立，然后前脚发力回到起点换侧。' },
  },
  {
    id: 475, slug: 'pull-up', zh: '引体向上', aliases: ['引体向上', '单杠引体', 'pull up', 'pullup', 'chin up'],
    family: '上肢垂直拉', movement: 'flexion-extension', pattern: 'vertical-pull', side: 'bilateral',
    level: 'advanced', equipmentKey: 'pull-up-bar', environment: ['outdoor', 'gym'], rig: 'pull-up',
    teaching: { position: 'hanging', description: '双手正握单杠，握距略宽于肩。肩胛先下沉，然后屈肘把下巴拉过杠，下降时有控制。先能完成悬垂和离心下降再尝试完整引体。' },
  },
  {
    id: 2690, slug: 'active-hang', zh: '悬垂', aliases: ['悬垂', '单杠悬垂', '吊杠', 'dead hang', 'bar hang'],
    family: '上肢悬垂', movement: 'isometric', pattern: 'hang', side: 'bilateral',
    level: 'beginner', equipmentKey: 'pull-up-bar', environment: ['outdoor', 'gym'], rig: 'hang',
    teaching: { position: 'hanging', description: '双手握住单杠自然悬垂，肩胛保持轻微收紧，避免完全松垮。这是单杠技能的基础，也是老年人保持握力和肩部健康的低门槛动作。' },
  },
  {
    id: 184, slug: 'deadlift', zh: '硬拉', aliases: ['硬拉', '杠铃硬拉', 'deadlift', 'barbell deadlift'],
    family: '髋主导拉', movement: 'hip-hinge', pattern: 'hinge', side: 'bilateral',
    level: 'intermediate', equipmentKey: 'barbell', environment: ['gym'], rig: 'deadlift',
    teaching: { position: 'hinge-stand', description: '髋部向后推，屈膝让杠铃贴着腿部下降，背部保持中立。脚掌踩实地面，髋膝协同发力站直，不要用腰背把重量拉起来。' },
  },
  {
    id: 1307, slug: 'plank', zh: '平板支撑', aliases: ['平板支撑', '撑体', 'plank', 'front plank'],
    family: '核心抗伸展', movement: 'isometric', pattern: 'core-anti-extension', side: 'bilateral',
    level: 'beginner', equipmentKey: 'bodyweight', environment: ['home', 'gym', 'outdoor'], rig: 'plank',
    teaching: { position: 'forearm-plank', description: '前臂与脚尖撑地，肘在肩正下方。臀部收紧，骨盆中立，身体从后脑到脚跟成一条直线。宁短不塌腰。' },
  },
  {
    id: 1906, slug: 'glute-bridge', zh: '臀桥', aliases: ['臀桥', '桥式', 'glute bridge', 'bridge'],
    family: '髋伸展', movement: 'hip-extension', pattern: 'bridge', side: 'bilateral',
    level: 'beginner', equipmentKey: 'bodyweight', environment: ['home', 'office'], rig: 'glute-bridge',
    teaching: { position: 'supine', description: '仰卧屈膝，双脚踩地与髋同宽。收紧臀部把髋抬起到身体从肩到膝成一条直线，不要用腰顶起来，然后有控制地放下。' },
  },
  {
    id: 622, slug: 'calf-raise', zh: '站姿提踵', aliases: ['提踵', '站姿提踵', '小腿训练', 'calf raise', 'heel raise'],
    family: '踝跖屈', movement: 'flexion-extension', pattern: 'plantarflexion', side: 'bilateral',
    level: 'beginner', equipmentKey: 'bodyweight', environment: ['home', 'office'], rig: 'calf-raise',
    teaching: { position: 'standing-support', description: '扶稳墙面或椅背，脚跟缓慢抬起，在最高点停一下再控制着落下。走路、上下楼和防跌倒都依赖这个动作；老年人可以先做双足，再过渡到单足。' },
  },
  {
    id: 92, slug: 'biceps-curl', zh: '哑铃弯举', aliases: ['弯举', '哑铃弯举', '二头弯举', 'biceps curl', 'dumbbell curl'],
    family: '上肢屈曲', movement: 'flexion-extension', pattern: 'elbow-flexion', side: 'alternating',
    level: 'beginner', equipmentKey: 'dumbbell', environment: ['home', 'gym'], rig: 'curl',
    teaching: { position: 'standing-arms', description: '站直，手掌朝向身体或朝上，肘部贴近躯干。屈肘把重量带向肩部，下放时控制，不要用身体摆动甩起来。' },
  },
];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|ol|ul|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function instructionLines(description) {
  const lines = stripHtml(description).split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  return lines.slice(1); // first line is the prose introduction, then steps
}

async function api(pathname) {
  const url = `https://wger.de/api/v2/${pathname}`;
  const res = await fetch(url, { headers: { 'User-Agent': PINNED.userAgent, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(mediaDir, { recursive: true });
  const snapshotsDir = path.join(outDir, 'raw');
  if (!OFFLINE) fs.mkdirSync(snapshotsDir, { recursive: true });

  const equipment = (await api('equipment/?limit=100')).results;
  const categories = (await api('exercisecategory/?limit=100')).results;
  const languages = (await api('language/?limit=100')).results;
  const equipmentById = Object.fromEntries(equipment.map(e => [e.id, e.name]));
  const categoryById = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const langById = Object.fromEntries(languages.map(l => [l.id, l.short_name]));

  const items = [];
  for (const sel of SELECTION) {
    const snapFile = path.join(snapshotsDir, `${sel.id}.json`);
    let record;
    if (!OFFLINE) {
      record = (await api(`exerciseinfo/?id=${sel.id}`)).results[0];
      if (!record) throw new Error(`record ${sel.id} not found upstream`);
      fs.writeFileSync(snapFile, JSON.stringify(record, null, 1) + '\n');
    } else {
      if (!fs.existsSync(snapFile)) throw new Error(`offline: missing snapshot for record ${sel.id}`);
      record = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
    }
    if (!record.license) throw new Error(`record ${sel.id} has no explicit license`);
    const en = (record.translations || []).find(t => t.language === 2);
    if (!en) {
      console.warn(`record ${sel.id} has no English translation; skipping instructions`);
    }
    const images = [];
    for (const image of (record.images || [])) {
      const file = `${sel.slug}-wger-image-${image.id}.png`;
      const local = path.join(mediaDir, file);
      if (!OFFLINE) {
        const buf = Buffer.from(await (await fetch(image.image, { headers: { 'User-Agent': PINNED.userAgent } })).arrayBuffer());
        fs.writeFileSync(local, buf);
      }
      if (!fs.existsSync(local)) continue;
      images.push({
        id: image.id,
        file: `assets/movement/wger/${file}`,
        sha256: sha256(fs.readFileSync(local)),
        bytes: fs.statSync(local).size,
        license: record.license.short_name,
        licenseUrl: record.license.url,
        licenseTitle: image.license_title || '',
        author: image.license_author || record.license_author,
        aiGenerated: Boolean(image.is_ai_generated),
        sourceUrl: image.image,
      });
    }
    const videos = (record.videos || []).map(v => {
      // Older records often carry a 404 YouTube id; only keep explicit non-YouTube URLs.
      const url = v.video || '';
      return { id: v.id, url, playable: Boolean(url) && !/youtube|youtu\.be/i.test(url) };
    });
    const equipmentNames = (record.equipment || []).map(e => equipmentById[e.id] || e.name);
    const primaryMuscles = (record.muscles || []).map(m => m.name).filter(Boolean);
    const secondaryMuscles = (record.muscles_secondary || []).map(m => m.name).filter(Boolean);

    items.push({
      id: `exercise:wger:${sel.id}:${sel.slug}`,
      upstream: {
        project: PINNED.project,
        projectUrl: PINNED.projectUrl,
        api: `https://wger.de/api/v2/exerciseinfo/?id=${sel.id}`,
        recordId: record.id,
        uuid: record.uuid,
        snapshot: `data/movement/raw/${sel.id}.json`,
        license: record.license.short_name,
        licenseName: record.license.full_name,
        licenseUrl: record.license.url,
        author: record.license_author || '',
        created: record.created,
        lastUpdate: record.last_update,
      },
      names: {
        zh: sel.zh,
        en: en ? en.name : (record.translations?.[0]?.name || sel.slug),
        upstreamTranslations: (record.translations || []).map(t => ({ lang: langById[t.language] || String(t.language), name: t.name })),
        aliases: sel.aliases,
      },
      category: { upstream: categoryById[record.category?.id] || '', family: sel.family },
      equipment: { list: equipmentNames, key: sel.equipmentKey },
      environment: sel.environment,
      level: sel.level,
      pattern: { key: sel.pattern, movement: sel.movement, side: sel.side },
      teaching: {
        position: sel.teaching.position,
        description: sel.teaching.description,
        upstreamInstructions: en ? instructionLines(en.description) : [],
        upstreamIntro: en ? stripHtml(en.description).split('\n')[0] : '',
        upstreamLanguage: en ? 'en' : null,
        translationStatus: en ? 'upstream_english_verbatim; zh is project-authored teaching text' : 'no_english_translation',
      },
      anatomy: {
        primaryMuscles,
        secondaryMuscles,
        muscleRoleSource: 'wger record muscles / muscles_secondary (upstream), mapped to BodyParts3D mesh ids in anatomy catalog',
      },
      media: { images, videos: videos.filter(v => v.playable), videoStatus: videos.some(v => !v.playable) ? 'upstream_links_unusable_or_external' : 'none' },
      rig: sel.rig,
      provenance: {
        contentStatus: 'LICENSED_RECORD_IMPORTED',
        instructionStatus: en ? 'UPSTREAM_ENGLISH_VERBATIM_PLUS_PROJECT_ZH' : 'PROJECT_ZH_ONLY',
        limitation: '中文名称、教学要点、分类与难度为本项目编写；上游仅提供英文（或其它语言）说明与肌群。不把项目编写内容冒充上游专业内容。',
      },
    });
  }

  const catalog = {
    schema: 'zero-one.movement.exercise-catalog.v1',
    builtAt: new Date().toISOString(),
    pinned: PINNED,
    count: items.length,
    licenses: {
      upstreamServer: { name: 'wger Workout Manager', license: 'AGPL-3.0', url: 'https://github.com/wger-project/wger/blob/master/LICENSE.txt' },
      recordContent: { name: 'CC-BY-SA 4.0 per record', attributionField: 'upstream.author' },
    },
    items,
  };
  fs.writeFileSync(path.join(outDir, 'exercise-catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
  console.log(`catalog: ${items.length} exercises -> portal/data/movement/exercise-catalog.json`);
  for (const item of items) {
    const media = item.media.images.length;
    console.log(`  ${item.id}  ${item.names.zh} / ${item.names.en}  [${item.anatomy.primaryMuscles.join(', ')}]  media:${media}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
