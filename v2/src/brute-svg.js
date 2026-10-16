
import { BRUTE_PARTS, DEFAULT_APPEARANCE } from './brute-config.js'

function idx(value, length) {
  const n = Number(value)
  return Number.isFinite(n)
    ? Math.max(0, Math.min(length - 1, Math.floor(n)))
    : 0
}

function safeColor(value, fallback) {
  const v = String(value || '')
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback
}

function normalizeAppearance(input = {}) {
  const colors = Array.isArray(input.colors)
    ? [
        safeColor(input.colors[0], DEFAULT_APPEARANCE.colors[0]),
        safeColor(input.colors[1], DEFAULT_APPEARANCE.colors[1]),
      ]
    : [...DEFAULT_APPEARANCE.colors]

  return {
    ...DEFAULT_APPEARANCE,
    ...input,
    colors,
  }
}

function hairSvg(style, c) {
  const s = idx(style, BRUTE_PARTS.hairs.length)
  const map = [
    '<path d="M102 76 Q150 37 198 76 Q177 47 150 48 Q122 48 102 76Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M108 75 L119 42 L134 54 L148 24 L161 53 L176 37 L192 75 Q150 50 108 75Z" fill="'+c+'" stroke="#171717" stroke-width="5" stroke-linejoin="round"/>',
    '<circle cx="187" cy="48" r="22" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M102 76 Q150 37 198 76 Q177 47 150 48 Q122 48 102 76Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<g fill="'+c+'" stroke="#171717" stroke-width="4"><circle cx="109" cy="64" r="23"/><circle cx="132" cy="45" r="26"/><circle cx="159" cy="42" r="27"/><circle cx="185" cy="53" r="24"/><circle cx="199" cy="75" r="20"/><circle cx="100" cy="83" r="19"/></g>',
    '<path d="M101 75 Q123 42 153 45 Q190 45 201 78 L202 132 Q184 143 181 116 L176 79 Q139 61 103 85Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '',
    '<path d="M102 75 Q150 38 198 75 Q178 48 150 47 Q121 48 102 75Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M103 77 Q76 90 83 123 Q94 109 111 104Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M197 77 Q224 90 217 123 Q206 109 189 104Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M101 71 Q139 34 199 70 Q188 63 177 58 Q167 94 116 115 Q126 82 101 71Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M102 74 Q150 38 198 75 Q178 48 150 48 Q121 48 102 74Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><g fill="none" stroke="'+c+'" stroke-width="11" stroke-linecap="round"><path d="M108 78 Q88 102 96 136"/><path d="M122 68 Q103 101 111 141"/><path d="M181 68 Q201 100 192 139"/><path d="M194 78 Q214 102 204 136"/></g>',
    '<path d="M100 74 Q109 38 137 47 Q150 18 183 34 Q209 47 197 76 Q181 51 151 58 Q122 49 100 74Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M103 74 Q150 38 198 76 Q179 49 150 48 Q120 49 103 74Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M195 60 Q235 72 224 126 Q210 105 190 97Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M112 68 Q129 41 153 42 Q180 42 192 66 L180 66 Q160 55 126 69Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
  ]
  return map[s] || ''
}

function eyesSvg(style) {
  const s = idx(style, BRUTE_PARTS.eyes.length)
  const pupils = '<circle cx="132" cy="97" r="4" fill="#111"/><circle cx="172" cy="97" r="4" fill="#111"/>'
  return [
    '<path d="M117 90 Q132 82 146 90" fill="none" stroke="#171717" stroke-width="5" stroke-linecap="round"/><path d="M158 90 Q173 82 187 90" fill="none" stroke="#171717" stroke-width="5" stroke-linecap="round"/>'+pupils,
    '<path d="M116 84 L146 92 M188 84 L158 92" stroke="#171717" stroke-width="6" stroke-linecap="round"/>'+pupils,
    '<path d="M117 94 L146 94 M159 94 L188 94" stroke="#171717" stroke-width="5" stroke-linecap="round"/><circle cx="132" cy="99" r="3" fill="#111"/><circle cx="173" cy="99" r="3" fill="#111"/>',
    '<circle cx="132" cy="96" r="9" fill="#fff" stroke="#171717" stroke-width="4"/><circle cx="173" cy="96" r="9" fill="#fff" stroke="#171717" stroke-width="4"/><circle cx="134" cy="96" r="4" fill="#111"/><circle cx="170" cy="96" r="4" fill="#111"/>',
    '<path d="M118 87 Q132 80 146 88 M159 88 Q173 80 187 87" fill="none" stroke="#171717" stroke-width="5"/><ellipse cx="132" cy="97" rx="4" ry="6" fill="#111"/><ellipse cx="173" cy="97" rx="4" ry="6" fill="#111"/>',
    '<path d="M119 94 Q132 102 145 94 M160 94 Q173 102 186 94" fill="none" stroke="#171717" stroke-width="4"/>',
  ][s]
}

function mouthSvg(style) {
  const s = idx(style, BRUTE_PARTS.mouths.length)
  return [
    '<path d="M137 126 Q151 129 166 126" fill="none" stroke="#5b2e24" stroke-width="5" stroke-linecap="round"/>',
    '<path d="M136 124 Q152 139 168 123 Q152 148 136 124Z" fill="#fff" stroke="#5b2e24" stroke-width="4"/>',
    '<path d="M136 131 Q151 117 168 132" fill="none" stroke="#5b2e24" stroke-width="5" stroke-linecap="round"/>',
    '<ellipse cx="152" cy="130" rx="13" ry="11" fill="#6d2929" stroke="#4a1e1e" stroke-width="4"/>',
    '<path d="M136 129 Q150 134 166 124" fill="none" stroke="#5b2e24" stroke-width="5" stroke-linecap="round"/>',
    '<path d="M136 128 L166 128" stroke="#5b2e24" stroke-width="5" stroke-linecap="round"/><path d="M145 128 L148 134 M155 128 L155 134" stroke="#fff" stroke-width="3"/>',
  ][s]
}

function beardSvg(style, c) {
  const s = idx(style, BRUTE_PARTS.beards.length)
  return [
    '',
    '<path d="M136 119 Q152 127 168 119 Q161 132 152 128 Q143 132 136 119Z" fill="'+c+'" stroke="#171717" stroke-width="3"/>',
    '<path d="M143 132 Q152 141 162 132 L160 150 Q151 157 143 149Z" fill="'+c+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M121 117 Q126 157 152 165 Q181 155 184 116 Q173 139 152 143 Q132 140 121 117Z" fill="'+c+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M116 115 Q121 164 151 182 Q185 163 189 112 Q177 143 152 150 Q128 142 116 115Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
  ][s]
}

function topSvg(style, primary, secondary, skin) {
  const s = idx(style, BRUTE_PARTS.tops.length)
  return [
    '<path d="M112 158 Q150 143 190 158 L197 254 L104 254Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M128 153 L132 187 L170 187 L174 153 Q151 143 128 153Z" fill="'+skin+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M113 156 Q150 142 190 156 L196 257 L105 257Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M129 153 L132 183 L171 183 L175 153" fill="'+secondary+'" stroke="#171717" stroke-width="4"/><path d="M136 157 L165 157 L164 252 L137 252Z" fill="'+secondary+'" opacity=".72"/>',
    '<path d="M105 161 Q151 139 198 161 L202 250 L100 250Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M100 165 L82 186 L98 205 L112 190Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M201 165 L220 186 L204 205 L190 190Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M111 157 Q151 144 191 157 L196 251 L106 251Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/><path d="M121 172 Q151 187 181 172" fill="none" stroke="#a86f54" stroke-width="4" opacity=".55"/>',
  ][s]
}

function bottomSvg(style, primary, secondary) {
  const s = idx(style, BRUTE_PARTS.bottoms.length)
  return [
    '<path d="M106 245 L149 245 L145 303 L104 303Z M151 245 L196 245 L198 303 L156 303Z" fill="'+secondary+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M106 242 L196 242 L193 305 L155 305 L151 268 L146 305 L108 305Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M107 251 L195 251" stroke="'+secondary+'" stroke-width="7"/>',
    '<path d="M108 244 L149 244 L145 314 L111 314Z M151 244 L194 244 L191 314 L156 314Z" fill="'+secondary+'" stroke="#171717" stroke-width="5"/><path d="M112 277 L145 277 M157 277 L190 277" stroke="'+primary+'" stroke-width="5"/>',
  ][s]
}

function accessorySvg(style, primary) {
  const s = idx(style, BRUTE_PARTS.accessories.length)
  return [
    '',
    '<path d="M103 81 Q151 65 199 81 L198 94 Q151 82 104 94Z" fill="'+primary+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M104 294 L146 294 L143 314 L108 314Z M156 294 L196 294 L191 314 L158 314Z" fill="'+primary+'" stroke="#171717" stroke-width="4"/>',
    '<rect x="76" y="203" width="33" height="16" rx="5" fill="'+primary+'" stroke="#171717" stroke-width="4"/><rect x="194" y="203" width="33" height="16" rx="5" fill="'+primary+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M126 167 Q151 190 177 167" fill="none" stroke="#e8bd34" stroke-width="7" stroke-linecap="round"/><circle cx="151" cy="185" r="6" fill="#e8bd34" stroke="#6c5214" stroke-width="3"/>',
    '<path d="M115 91 Q130 84 146 92 L143 108 Q129 111 117 105Z M158 92 Q175 84 190 91 L187 106 Q174 112 160 108Z" fill="#101827" stroke="#171717" stroke-width="4"/><path d="M144 96 L160 96" stroke="#171717" stroke-width="5"/>',
  ][s]
}

export function renderBruteSvg(input = {}, options = {}) {
  const a = normalizeAppearance(input)
  const bodyId = idx(a.body, BRUTE_PARTS.bodies.length)
  const skin = BRUTE_PARTS.skins[idx(a.skin, BRUTE_PARTS.skins.length)]
  const hair = BRUTE_PARTS.hairColors[idx(a.hairColor, BRUTE_PARTS.hairColors.length)]
  const primary = safeColor(a.colors[0], '#7c3aed')
  const secondary = safeColor(a.colors[1], '#111827')
  const widths = [78, 92, 108, 122]
  const torsoW = widths[bodyId]
  const torsoX = 150 - torsoW / 2
  const mirror = options.side === 'left' ? 'translate(300 0) scale(-1 1)' : ''
  const label = String(options.label || '').replaceAll('"', '&quot;')
  const weapon = options.weapon
  const pet = options.pet

  const weaponMarkup = weapon
    ? '<g class="brute-limb brute-weapon" data-brute-part="weapon" transform="translate(216 190)"><text x="0" y="0" text-anchor="middle" font-size="42">'+String(weapon.icon || '👊')+'</text></g>'
    : ''

  const petMarkup = pet
    ? '<g class="brute-pet" data-brute-part="pet" transform="translate(240 286)"><circle r="29" fill="#fff4c3" stroke="#171717" stroke-width="5"/><text x="0" y="10" text-anchor="middle" font-size="31">'+String(pet.emoji || '🐀')+'</text></g>'
    : ''

  return '<svg class="ga-brute-svg '+String(options.className || '')+'" data-side="'+String(options.side || 'right')+'" viewBox="0 0 300 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+label+'">'+
    '<g class="brute-stage" transform="'+mirror+'">'+
      '<ellipse cx="151" cy="334" rx="88" ry="15" fill="rgba(0,0,0,.18)"/>'+
      '<g class="brute-limb brute-leg brute-leg-left" data-brute-part="leg-left"><path d="M110 284 L145 284 L141 329 L108 329Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/><path d="M98 321 Q119 312 145 321 L143 339 L94 339 Q89 329 98 321Z" fill="#f4ead2" stroke="#171717" stroke-width="5"/></g>'+
      '<g class="brute-limb brute-leg brute-leg-right" data-brute-part="leg-right"><path d="M157 284 L192 284 L194 329 L160 329Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/><path d="M158 321 Q183 312 204 321 Q213 329 208 339 L159 339Z" fill="#f4ead2" stroke="#171717" stroke-width="5"/></g>'+
      '<g class="brute-bottom" data-brute-part="bottom">'+bottomSvg(a.bottom, primary, secondary)+'</g>'+
      '<g class="brute-limb brute-arm brute-arm-left" data-brute-part="arm-left"><path d="M'+(torsoX+8)+' 181 Q72 188 82 236 Q89 252 102 241 L118 198Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/><circle cx="88" cy="239" r="15" fill="'+skin+'" stroke="#171717" stroke-width="5"/></g>'+
      '<g class="brute-limb brute-arm brute-arm-right" data-brute-part="arm-right"><path d="M'+(torsoX+torsoW-8)+' 181 Q228 187 220 234 Q213 251 199 242 L184 198Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/><circle cx="216" cy="239" r="15" fill="'+skin+'" stroke="#171717" stroke-width="5"/></g>'+
      '<g class="brute-torso" data-brute-part="torso"><path d="M'+torsoX+' 175 Q150 140 '+(torsoX+torsoW)+' 175 L'+(torsoX+torsoW-4)+' 275 L'+(torsoX+4)+' 275Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+topSvg(a.top, primary, secondary, skin)+'</g>'+
      '<g class="brute-neck"><rect x="134" y="133" width="35" height="39" rx="12" fill="'+skin+'" stroke="#171717" stroke-width="5"/></g>'+
      '<g class="brute-head" data-brute-part="head">'+
        '<path d="M103 82 Q111 53 151 51 Q192 53 201 83 L194 124 Q185 154 151 160 Q118 155 107 126Z" fill="'+skin+'" stroke="#171717" stroke-width="6"/>'+
        '<path d="M103 102 Q91 97 94 114 Q98 129 109 125 M199 102 Q212 97 209 115 Q204 129 193 125" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
        '<g data-brute-part="eyes">'+eyesSvg(a.eyes)+'</g>'+
        '<path d="M151 98 L146 116 Q152 121 159 116" fill="none" stroke="#8b5a45" stroke-width="4" stroke-linecap="round"/>'+
        '<g data-brute-part="mouth">'+mouthSvg(a.mouth)+'</g>'+
        '<g data-brute-part="beard">'+beardSvg(a.beard, hair)+'</g>'+
        '<g data-brute-part="hair">'+hairSvg(a.hair, hair)+'</g>'+
      '</g>'+
      '<g data-brute-part="accessory">'+accessorySvg(a.acc, primary)+'</g>'+
      weaponMarkup+petMarkup+
    '</g>'+
  '</svg>'
}

export function renderPetSvg(pet, side = 'right') {
  const emoji = String(pet?.emoji || '🐀')
  const name = String(pet?.name || 'Familier').replaceAll('"', '&quot;')
  return '<svg class="ga-brute-pet-svg" data-side="'+side+'" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-label="'+name+'"><ellipse cx="60" cy="102" rx="39" ry="8" fill="rgba(0,0,0,.17)"/><circle cx="60" cy="54" r="38" fill="#fff4c3" stroke="#171717" stroke-width="6"/><text x="60" y="68" text-anchor="middle" font-size="49">'+emoji+'</text></svg>'
}
