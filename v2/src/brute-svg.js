import {
  BRUTE_PARTS,
  DEFAULT_APPEARANCE,
} from './brute-config.js'

function idx(value, length) {
  const n = Number(value)

  return Number.isFinite(n)
    ? Math.max(
        0,
        Math.min(
          length - 1,
          Math.floor(n)
        )
      )
    : 0
}

function safeColor(value, fallback) {
  const v = String(value || '')

  return /^#[0-9a-f]{3,8}$/i.test(v)
    ? v
    : fallback
}

function mixColor(value, target, amount = .5) {
  const expand = input => {
    const raw =
      String(input || '')
        .replace('#','')
        .slice(0,6)

    if (raw.length === 3) {
      return raw
        .split('')
        .map(char => char + char)
        .join('')
    }

    return raw.padEnd(6,'0')
  }

  const from = expand(value)
  const to = expand(target)
  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        Number(amount) || 0
      )
    )

  const channel = offset => {
    const a =
      parseInt(
        from.slice(
          offset,
          offset + 2
        ),
        16
      )

    const b =
      parseInt(
        to.slice(
          offset,
          offset + 2
        ),
        16
      )

    return Math.round(
      a +
      (
        b - a
      ) *
      ratio
    )
      .toString(16)
      .padStart(2,'0')
  }

  return '#'+
    channel(0)+
    channel(2)+
    channel(4)
}

function hairSheenSvg(style, color) {
  if (
    idx(
      style,
      BRUTE_PARTS.hairs.length
    ) === 5
  ) {
    return ''
  }

  return '<path d="M129 61 Q157 45 187 58" fill="none" stroke="'+color+'" stroke-width="5" stroke-linecap="round" opacity=".42"/>'+
    '<path d="M136 72 Q157 61 177 68" fill="none" stroke="'+color+'" stroke-width="3" stroke-linecap="round" opacity=".26"/>'
}

function normalizeAppearance(input = {}) {
  const colors =
    Array.isArray(input.colors)
      ? [
          safeColor(
            input.colors[0],
            DEFAULT_APPEARANCE.colors[0]
          ),
          safeColor(
            input.colors[1],
            DEFAULT_APPEARANCE.colors[1]
          ),
        ]
      : [...DEFAULT_APPEARANCE.colors]

  return {
    ...DEFAULT_APPEARANCE,
    ...input,
    colors,
  }
}

function bodyMetrics(body) {
  const list = [
    {
      shoulder: 80,
      waist: 66,
      torsoH: 94,
      armW: 19,
      thighW: 25,
      neckW: 27,
      headScale: 1.14,
    },
    {
      shoulder: 91,
      waist: 73,
      torsoH: 96,
      armW: 22,
      thighW: 28,
      neckW: 29,
      headScale: 1.16,
    },
    {
      shoulder: 101,
      waist: 79,
      torsoH: 92,
      armW: 25,
      thighW: 31,
      neckW: 31,
      headScale: 1.17,
    },
    {
      shoulder: 111,
      waist: 85,
      torsoH: 99,
      armW: 28,
      thighW: 34,
      neckW: 34,
      headScale: 1.18,
    },
    {
      shoulder: 121,
      waist: 90,
      torsoH: 101,
      armW: 31,
      thighW: 37,
      neckW: 36,
      headScale: 1.19,
    },
    {
      shoulder: 130,
      waist: 99,
      torsoH: 102,
      armW: 34,
      thighW: 40,
      neckW: 39,
      headScale: 1.20,
    },
    {
      shoulder: 87,
      waist: 65,
      torsoH: 103,
      armW: 20,
      thighW: 24,
      neckW: 27,
      headScale: 1.15,
    },
    {
      shoulder: 116,
      waist: 94,
      torsoH: 91,
      armW: 33,
      thighW: 36,
      neckW: 37,
      headScale: 1.18,
    },
  ]

  return list[
    idx(
      body,
      list.length
    )
  ]
}

function headShapeSvg(style, skin) {
  const s =
    idx(
      style,
      BRUTE_PARTS.heads.length
    )

  const map = [
    '<path d="M109 80 Q116 47 160 45 Q204 47 211 80 L208 121 Q205 144 188 157 Q176 167 160 169 Q144 167 132 157 Q115 144 112 121Z" fill="'+skin+'" stroke="#171717" stroke-width="5.5"/>',
    '<path d="M108 78 Q116 45 160 44 Q204 46 212 78 L210 123 Q205 148 185 160 Q174 168 160 169 Q145 168 134 160 Q115 148 110 123Z" fill="'+skin+'" stroke="#171717" stroke-width="5.5"/>',
    '<path d="M108 83 Q114 48 160 45 Q206 48 212 83 L208 125 Q203 151 183 162 Q173 168 160 168 Q147 168 137 162 Q117 151 112 125Z" fill="'+skin+'" stroke="#171717" stroke-width="5.5"/>',
    '<path d="M115 80 Q122 49 160 47 Q198 49 205 80 L202 123 Q198 147 181 158 Q171 164 160 165 Q149 164 139 158 Q122 147 118 123Z" fill="'+skin+'" stroke="#171717" stroke-width="5.5"/>',
    '<path d="M106 78 Q114 44 160 43 Q207 44 214 79 L211 120 Q208 144 190 158 Q177 169 160 171 Q143 169 130 158 Q112 144 109 120Z" fill="'+skin+'" stroke="#171717" stroke-width="5.5"/>',
    '<path d="M110 80 Q117 46 160 44 Q203 46 210 80 L206 119 Q202 143 184 158 Q174 166 160 168 Q146 166 136 158 Q118 143 114 119Z" fill="'+skin+'" stroke="#171717" stroke-width="5.5"/>',
    '<path d="M106 79 Q116 44 160 42 Q204 44 214 79 L210 118 Q205 145 187 159 Q175 169 160 172 Q145 169 133 159 Q115 145 110 118Z" fill="'+skin+'" stroke="#171717" stroke-width="5.5"/>',
    '<path d="M103 84 Q107 45 160 43 Q213 45 217 84 L214 123 Q209 151 186 163 Q174 170 160 171 Q146 170 134 163 Q111 151 106 123Z" fill="'+skin+'" stroke="#171717" stroke-width="5.5"/>',
  ]

  return map[s] || map[0]
}

function hairSvg(style, c) {
  const s =
    idx(
      style,
      BRUTE_PARTS.hairs.length
    )

  const map = [
    '<path d="M114 74 Q160 42 206 75 Q189 52 160 52 Q132 52 114 74Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M119 73 L130 42 L143 54 L159 22 L174 53 L191 38 L202 74 Q160 51 119 73Z" fill="'+c+'" stroke="#171717" stroke-width="5" stroke-linejoin="round"/>',
    '<circle cx="199" cy="45" r="24" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M115 76 Q160 42 205 76 Q188 53 160 52 Q132 53 115 76Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<g fill="'+c+'" stroke="#171717" stroke-width="4"><circle cx="113" cy="66" r="22"/><circle cx="135" cy="46" r="27"/><circle cx="162" cy="42" r="29"/><circle cx="189" cy="51" r="26"/><circle cx="205" cy="73" r="22"/><circle cx="106" cy="86" r="19"/></g>',
    '<path d="M112 74 Q133 43 162 46 Q197 47 208 79 L208 140 Q187 150 185 117 L181 80 Q145 62 114 87Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '',
    '<path d="M115 75 Q160 43 204 75 Q188 52 160 51 Q132 52 115 75Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M116 80 Q83 91 90 130 Q102 111 119 105Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M204 80 Q237 91 229 130 Q218 111 201 105Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M111 70 Q145 34 209 69 Q194 62 180 58 Q170 96 119 116 Q130 81 111 70Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M113 73 Q160 39 207 75 Q189 49 160 49 Q132 49 113 73Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><g fill="none" stroke="'+c+'" stroke-width="11" stroke-linecap="round"><path d="M118 78 Q96 105 103 145"/><path d="M132 68 Q113 103 119 150"/><path d="M188 68 Q207 103 200 149"/><path d="M201 78 Q223 105 215 145"/></g>',
    '<path d="M112 73 Q118 37 146 47 Q160 20 192 35 Q216 48 204 77 Q187 51 161 57 Q133 49 112 73Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M115 75 Q160 42 205 76 Q188 53 160 52 Q132 53 115 75Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M202 60 Q241 72 231 128 Q217 106 198 98Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M122 67 Q137 42 161 42 Q190 42 200 68 L189 68 Q168 56 133 70Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<g fill="'+c+'" stroke="#171717" stroke-width="4"><circle cx="122" cy="61" r="17"/><circle cx="143" cy="49" r="18"/><circle cx="164" cy="47" r="18"/><circle cx="186" cy="54" r="18"/><circle cx="201" cy="68" r="15"/></g>',
    '<path d="M112 76 Q121 44 160 44 Q194 45 207 71 Q186 62 171 65 Q145 75 121 78Z" fill="'+c+'" stroke="#171717" stroke-width="5"/><path d="M178 58 L207 64 L202 78 L174 70Z" fill="'+c+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M111 77 Q125 43 160 43 Q196 43 209 77 L207 144 Q196 161 191 125 L186 82 Q160 69 135 82 L129 126 Q124 160 112 143Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M112 73 Q160 41 208 74" fill="none" stroke="'+c+'" stroke-width="13" stroke-linecap="round"/><g fill="none" stroke="'+c+'" stroke-width="9" stroke-linecap="round"><path d="M124 68 Q108 103 116 146"/><path d="M141 57 Q126 106 135 151"/><path d="M158 54 Q148 107 155 151"/><path d="M177 58 Q191 105 183 149"/><path d="M195 68 Q211 105 203 145"/></g>',
    '<path d="M121 71 L133 45 L144 59 L158 26 L173 58 L187 44 L199 72 Q160 54 121 71Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M112 76 Q122 39 163 42 Q194 43 208 70 Q185 65 167 70 Q143 77 116 82Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
  ]

  return map[s] || ''
}

function eyesSvg(style) {
  const s =
    idx(
      style,
      BRUTE_PARTS.eyes.length
    )

  const pupils =
    '<circle cx="139" cy="101" r="5.2" fill="#151515"/><circle cx="181" cy="101" r="5.2" fill="#151515"/>'

  const map = [
    '<ellipse cx="139" cy="101" rx="9" ry="7" fill="#fff" stroke="#171717" stroke-width="3.5"/><ellipse cx="181" cy="101" rx="9" ry="7" fill="#fff" stroke="#171717" stroke-width="3.5"/>'+pupils,
    '<path d="M123 91 Q139 83 153 92 M167 92 Q181 83 197 91" fill="none" stroke="#171717" stroke-width="4.5" stroke-linecap="round"/>'+pupils,
    '<path d="M124 98 Q139 94 153 98 M168 98 Q181 94 196 98" fill="none" stroke="#171717" stroke-width="4.2" stroke-linecap="round"/><circle cx="139" cy="102" r="4.4" fill="#111"/><circle cx="181" cy="102" r="4.4" fill="#111"/>',
    '<circle cx="139" cy="100" r="11.5" fill="#fff" stroke="#171717" stroke-width="3.5"/><circle cx="181" cy="100" r="11.5" fill="#fff" stroke="#171717" stroke-width="3.5"/><circle cx="142" cy="100" r="5.2" fill="#111"/><circle cx="178" cy="100" r="5.2" fill="#111"/>',
    '<ellipse cx="139" cy="101" rx="8" ry="10" fill="#fff" stroke="#171717" stroke-width="3.4"/><ellipse cx="181" cy="101" rx="8" ry="10" fill="#fff" stroke="#171717" stroke-width="3.4"/><ellipse cx="140" cy="102" rx="4.2" ry="5.5" fill="#111"/><ellipse cx="180" cy="102" rx="4.2" ry="5.5" fill="#111"/>',
    '<path d="M124 99 Q139 108 153 99 M168 99 Q181 108 196 99" fill="none" stroke="#171717" stroke-width="4.2" stroke-linecap="round"/>',
    '<path d="M124 96 Q139 92 153 97 M168 97 Q181 92 196 96" fill="none" stroke="#171717" stroke-width="4.2" stroke-linecap="round"/><circle cx="139" cy="102" r="4.2" fill="#111"/><circle cx="181" cy="102" r="4.2" fill="#111"/>',
    '<path d="M123 91 Q139 84 154 93 M197 93 Q181 84 166 93" fill="none" stroke="#171717" stroke-width="4.8" stroke-linecap="round"/><circle cx="141" cy="101" r="5" fill="#111"/><circle cx="179" cy="101" r="5" fill="#111"/>',
  ]

  return map[s] || map[0]
}

function eyeLifeSvg(style) {
  const s =
    idx(
      style,
      BRUTE_PARTS.eyes.length
    )

  if (s === 5) {
    return ''
  }

  const size =
    s === 3
      ? 2.7
      : 2.15

  return (
    '<g class="brute-eye-life" fill="#ffffff" opacity=".84" pointer-events="none">'+
      '<circle cx="'+(s===3?143:140)+'" cy="'+(s===3?96:99)+'" r="'+size+'"/>'+
      '<circle cx="'+(s===3?178:182)+'" cy="'+(s===3?96:99)+'" r="'+size+'"/>'+
    '</g>'
  )
}

function cheekSvg(skin) {
  const blush =
    mixColor(
      skin,
      '#ef7f7a',
      .46
    )

  return (
    '<g class="brute-cheeks" fill="'+blush+'" opacity=".16" pointer-events="none">'+
      '<ellipse cx="128" cy="119" rx="10" ry="5"/>'+
      '<ellipse cx="192" cy="119" rx="10" ry="5"/>'+
    '</g>'
  )
}

function noseSvg(style, tone) {
  const s =
    idx(
      style,
      BRUTE_PARTS.noses.length
    )

  const map = [
    '<path d="M159 106 Q155 117 160 120 Q165 120 168 117" fill="none" stroke="'+tone+'" stroke-width="3.2" stroke-linecap="round"/>',
    '<path d="M158 108 Q155 116 160 120 Q164 122 168 117" fill="none" stroke="'+tone+'" stroke-width="3.1" stroke-linecap="round"/>',
    '<path d="M157 107 Q153 117 160 122 Q167 122 170 117" fill="none" stroke="'+tone+'" stroke-width="3.2" stroke-linecap="round"/>',
    '<path d="M159 105 Q164 112 157 120 Q162 123 168 119" fill="none" stroke="'+tone+'" stroke-width="3.1" stroke-linecap="round"/>',
    '<path d="M158 108 L155 116 Q160 122 166 118" fill="none" stroke="'+tone+'" stroke-width="3.1" stroke-linecap="round"/>',
    '<path d="M158 110 Q156 117 160 120 Q164 120 167 117" fill="none" stroke="'+tone+'" stroke-width="2.8" stroke-linecap="round"/>',
  ]

  return map[s] || map[0]
}

function mouthSvg(style) {
  const s =
    idx(
      style,
      BRUTE_PARTS.mouths.length
    )

  const map = [
    '<path d="M147 134 Q160 139 173 134" fill="none" stroke="#5b2e24" stroke-width="4" stroke-linecap="round"/>',
    '<path d="M146 132 Q160 145 175 132 Q160 149 146 132Z" fill="#fff" stroke="#5b2e24" stroke-width="3.5"/>',
    '<path d="M147 138 Q160 128 174 138" fill="none" stroke="#5b2e24" stroke-width="4" stroke-linecap="round"/>',
    '<ellipse cx="160" cy="137" rx="10" ry="9" fill="#6d2929" stroke="#4a1e1e" stroke-width="3.5"/><ellipse cx="160" cy="140" rx="5" ry="2.5" fill="#d86e79" opacity=".75"/>',
    '<path d="M147 136 Q159 142 173 132" fill="none" stroke="#5b2e24" stroke-width="4" stroke-linecap="round"/>',
    '<path d="M148 135 L173 135" stroke="#5b2e24" stroke-width="4" stroke-linecap="round"/><path d="M154 135 L156 140 M165 135 L165 140" stroke="#fff" stroke-width="2.5"/>',
    '<path d="M148 135 Q160 131 173 135" fill="none" stroke="#4f2922" stroke-width="4.5" stroke-linecap="round"/>',
    '<path d="M147 133 Q160 143 174 131" fill="none" stroke="#5b2e24" stroke-width="4" stroke-linecap="round"/><path d="M169 133 Q173 136 176 132" fill="none" stroke="#5b2e24" stroke-width="2.5"/>',
  ]

  return map[s] || map[0]
}

function beardSvg(style, c) {
  const s =
    idx(
      style,
      BRUTE_PARTS.beards.length
    )

  const map = [
    '',
    '<path d="M143 124 Q160 132 177 124 Q170 137 160 133 Q150 137 143 124Z" fill="'+c+'" stroke="#171717" stroke-width="3"/>',
    '<path d="M151 139 Q160 148 169 139 L168 157 Q160 165 151 157Z" fill="'+c+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M128 124 Q134 151 160 154 Q185 151 192 124 Q183 146 160 147 Q137 146 128 124Z" fill="'+c+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M124 120 Q130 162 160 171 Q191 161 196 118 Q185 149 160 156 Q136 149 124 120Z" fill="'+c+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M120 119 Q126 171 160 191 Q197 171 201 115 Q188 152 160 163 Q132 152 120 119Z" fill="'+c+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M143 123 Q160 131 177 123 Q171 137 160 133 Q150 137 143 123Z" fill="'+c+'" stroke="#171717" stroke-width="3"/><path d="M151 139 Q160 150 170 139 L168 158 Q160 165 151 157Z" fill="'+c+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M126 124 Q133 149 160 153 Q188 149 194 123" fill="none" stroke="'+c+'" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 8"/>',
  ]

  return map[s] || ''
}

function markingSvg(style, skin) {
  const s =
    idx(
      style,
      BRUTE_PARTS.markings.length
    )

  const map = [
    '',
    '<path d="M128 79 L137 91 M132 78 L141 91" stroke="#8c4b42" stroke-width="2.5" stroke-linecap="round"/>',
    '<path d="M188 110 L174 124 M191 114 L178 127" stroke="#8c4b42" stroke-width="2.5" stroke-linecap="round"/>',
    '<g fill="#a96d50" opacity=".7"><circle cx="139" cy="114" r="2"/><circle cx="145" cy="116" r="1.8"/><circle cx="181" cy="114" r="2"/><circle cx="175" cy="116" r="1.8"/><circle cx="160" cy="120" r="1.4"/></g>',
    '<path d="M122 107 Q139 116 151 107 M169 107 Q181 116 198 107" fill="none" stroke="#f8f8f2" stroke-width="5" opacity=".68" stroke-linecap="round"/>',
    '<path d="M123 96 L152 101 M168 101 L198 96" stroke="#111827" stroke-width="7" opacity=".8" stroke-linecap="round"/>',
  ]

  return map[s] || ''
}

function topSvg(
  style,
  primary,
  secondary,
  skin,
  torsoX,
  torsoW,
  torsoBottom
) {
  const s =
    idx(
      style,
      BRUTE_PARTS.tops.length
    )

  const left =
    torsoX + 5

  const right =
    torsoX + torsoW - 5

  const map = [
    '<path d="M'+left+' 179 Q160 155 '+right+' 179 L'+(right-4)+' '+torsoBottom+' L'+(left+4)+' '+torsoBottom+'Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M140 168 L143 198 L177 198 L180 168 Q160 156 140 168Z" fill="'+skin+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M'+left+' 177 Q160 154 '+right+' 177 L'+(right-3)+' '+torsoBottom+' L'+(left+3)+' '+torsoBottom+'Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M140 168 L143 194 L178 194 L181 168" fill="'+secondary+'" stroke="#171717" stroke-width="4"/><path d="M148 173 L173 173 L172 '+torsoBottom+' L149 '+torsoBottom+'Z" fill="'+secondary+'" opacity=".72"/>',
    '<path d="M'+(left-8)+' 182 Q160 151 '+(right+8)+' 182 L'+(right+8)+' '+(torsoBottom-4)+' L'+(left-8)+' '+(torsoBottom-4)+'Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M'+(left-7)+' 186 L'+(left-25)+' 207 L'+(left-9)+' 225 L'+(left+5)+' 207Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M'+(right+7)+' 186 L'+(right+25)+' 207 L'+(right+9)+' 225 L'+(right-5)+' 207Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M'+left+' 177 Q160 157 '+right+' 177 L'+(right-3)+' '+torsoBottom+' L'+(left+3)+' '+torsoBottom+'Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/><path d="M132 190 Q160 207 188 190" fill="none" stroke="#9f684f" stroke-width="4" opacity=".5"/><path d="M153 184 L150 210 M167 184 L170 210" stroke="#9f684f" stroke-width="3" opacity=".5"/>',
    '<path d="M'+left+' 178 Q160 153 '+right+' 178 L'+(right-4)+' '+torsoBottom+' L'+(left+4)+' '+torsoBottom+'Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M136 166 Q160 183 184 166 L181 193 Q160 204 140 193Z" fill="'+skin+'" stroke="#171717" stroke-width="4"/><path d="M'+(left+8)+' 220 L'+(right-8)+' 220" stroke="'+secondary+'" stroke-width="7"/>',
    '<path d="M'+left+' 178 Q160 157 '+right+' 178 L'+(right-4)+' '+torsoBottom+' L'+(left+4)+' '+torsoBottom+'Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M136 166 Q160 184 184 166 L180 191 Q160 202 140 191Z" fill="'+skin+'" stroke="#171717" stroke-width="4"/><path d="M'+(left+2)+' 235 L'+(right-2)+' 235" stroke="'+secondary+'" stroke-width="6"/>',
  ]

  return map[s] || map[0]
}

function bottomSvg(
  style,
  primary,
  secondary,
  body
) {
  const s =
    idx(
      style,
      BRUTE_PARTS.bottoms.length
    )

  const wide =
    body >= 4
      ? 4
      : body >= 2
        ? 2
        : 0

  const map = [
    '<path d="M109 '+(270-wide)+' L158 270 L153 325 L105 325Z M162 270 L211 '+(270-wide)+' L215 325 L167 325Z" fill="'+secondary+'" stroke="#171717" stroke-width="5"/>',
    '<path d="M108 266 L212 266 L207 327 L166 327 L160 289 L154 327 L113 327Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M111 278 L209 278" stroke="'+secondary+'" stroke-width="7"/>',
    '<path d="M111 269 L158 269 L153 338 L113 338Z M162 269 L209 269 L207 338 L167 338Z" fill="'+secondary+'" stroke="#171717" stroke-width="5"/><path d="M115 302 L153 302 M167 302 L205 302" stroke="'+primary+'" stroke-width="5"/>',
    '<path d="M108 270 L158 270 L154 318 L109 318Z M162 270 L212 270 L211 318 L166 318Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M111 281 L155 281 M165 281 L209 281" stroke="'+secondary+'" stroke-width="4"/>',
    '<path d="M110 268 L158 268 L154 341 L113 341Z M162 268 L210 268 L207 341 L166 341Z" fill="'+primary+'" stroke="#171717" stroke-width="5"/><path d="M119 269 L119 338 M201 269 L201 338" stroke="'+secondary+'" stroke-width="5" opacity=".7"/>',
  ]

  return map[s] || map[0]
}

function accessorySvg(
  style,
  primary,
  secondary
) {
  const s =
    idx(
      style,
      BRUTE_PARTS.accessories.length
    )

  const map = [
    '',
    '<path d="M111 84 Q160 68 209 84 L208 98 Q160 86 112 98Z" fill="'+primary+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M108 313 L155 313 L151 336 L112 336Z M165 313 L212 313 L207 336 L168 336Z" fill="'+primary+'" stroke="#171717" stroke-width="4"/>',
    '<rect x="77" y="216" width="36" height="17" rx="5" fill="'+primary+'" stroke="#171717" stroke-width="4"/><rect x="208" y="216" width="36" height="17" rx="5" fill="'+primary+'" stroke="#171717" stroke-width="4"/>',
    '<path d="M134 178 Q160 201 186 178" fill="none" stroke="#e8bd34" stroke-width="7" stroke-linecap="round"/><circle cx="160" cy="197" r="6" fill="#e8bd34" stroke="#6c5214" stroke-width="3"/>',
    '<path d="M123 95 Q139 88 154 96 L151 112 Q137 115 125 109Z M168 96 Q185 88 200 95 L197 110 Q184 116 170 112Z" fill="#101827" stroke="#171717" stroke-width="4"/><path d="M152 100 L169 100" stroke="#171717" stroke-width="5"/>',
    '<path d="M117 72 Q160 39 205 72 L203 86 Q159 74 118 87Z" fill="'+secondary+'" stroke="#171717" stroke-width="5"/><path d="M119 81 L103 88 L119 91Z" fill="'+primary+'" stroke="#171717" stroke-width="3"/>',
    '<rect x="143" y="84" width="34" height="9" rx="4" fill="#f0e8d8" stroke="#171717" stroke-width="3"/>',
    '<circle cx="207" cy="113" r="6" fill="#e8bd34" stroke="#6c5214" stroke-width="3"/>',
    '<path d="M115 253 Q160 269 205 253 L207 272 Q160 287 113 272Z" fill="'+secondary+'" stroke="#171717" stroke-width="5"/><rect x="153" y="258" width="18" height="15" rx="3" fill="#d5aa45" stroke="#171717" stroke-width="3"/>',
  ]

  return map[s] || ''
}

function faceModelSvg(
  body,
  hair,
  skinShadow,
  skinHighlight,
  fightModel
) {
  const strong =
    body >= 3

  return (
    '<g class="brute-face-model" pointer-events="none" opacity=".58">'+
      '<path d="M123 108 Q128 127 139 140" fill="none" stroke="'+skinShadow+'" stroke-width="'+(strong?3.2:2.6)+'" opacity=".18" stroke-linecap="round"/>'+
      '<path d="M197 108 Q192 127 181 140" fill="none" stroke="'+skinShadow+'" stroke-width="'+(strong?3.2:2.6)+'" opacity=".18" stroke-linecap="round"/>'+
      '<path d="M145 151 Q160 158 176 151" fill="none" stroke="'+skinShadow+'" stroke-width="3" opacity=".26" stroke-linecap="round"/>'+
      '<path d="M138 143 Q146 158 160 161 Q174 158 182 143" fill="none" stroke="'+skinShadow+'" stroke-width="'+(strong?3.2:2.6)+'" opacity=".16" stroke-linecap="round"/>'+
      '<path d="M151 154 Q160 158 169 154" fill="none" stroke="'+skinHighlight+'" stroke-width="2.3" opacity=".2" stroke-linecap="round"/>'+
      '<path d="M150 72 Q160 67 171 72" fill="none" stroke="'+skinHighlight+'" stroke-width="3" opacity=".22" stroke-linecap="round"/>'+
      '<path d="M153 109 Q160 105 167 109" fill="none" stroke="'+skinHighlight+'" stroke-width="2.5" opacity=".23" stroke-linecap="round"/>'+
      (
        fightModel
          ? '<path d="M126 86 Q139 79 151 86 M169 86 Q182 79 195 86" fill="none" stroke="'+hair+'" stroke-width="4.2" opacity=".64" stroke-linecap="round"/>'+
            '<path d="M128 119 Q138 125 148 122 M172 122 Q182 125 192 119" fill="none" stroke="'+skinShadow+'" stroke-width="2.4" opacity=".2" stroke-linecap="round"/>'
          : ''
      )+
    '</g>'
  )
}

function torsoSurfaceSvg(
  top,
  body,
  primaryShadow,
  primaryHighlight,
  skinShadow,
  skinHighlight,
  torsoX,
  torsoRight,
  torsoBottom
) {
  const bare =
    idx(
      top,
      BRUTE_PARTS.tops.length
    ) === 3

  const wide =
    body >= 3

  if (bare) {
    return (
      '<g class="brute-muscle-model" pointer-events="none" opacity=".48">'+
        '<path d="M'+(torsoX+15)+' 191 Q160 '+(wide?175:180)+' '+(torsoRight-15)+' 191" fill="none" stroke="'+skinShadow+'" stroke-width="'+(wide?4:3.2)+'" opacity=".32" stroke-linecap="round"/>'+
        '<path d="M160 193 L160 '+(torsoBottom-14)+'" stroke="'+skinShadow+'" stroke-width="2.8" opacity=".24" stroke-linecap="round"/>'+
        '<path d="M'+(torsoX+26)+' 207 Q143 216 151 209 M'+(torsoRight-26)+' 207 Q177 216 169 209" fill="none" stroke="'+skinShadow+'" stroke-width="2.5" opacity=".24" stroke-linecap="round"/>'+
        '<path d="M'+(torsoX+28)+' 230 Q144 239 151 232 M'+(torsoRight-28)+' 230 Q176 239 169 232" fill="none" stroke="'+skinShadow+'" stroke-width="2.4" opacity=".2" stroke-linecap="round"/>'+
        '<path d="M'+(torsoX+19)+' 184 Q142 173 151 180 M'+(torsoRight-19)+' 184 Q178 173 169 180" fill="none" stroke="'+skinHighlight+'" stroke-width="3" opacity=".23" stroke-linecap="round"/>'+
      '</g>'
    )
  }

  return (
    '<g class="brute-cloth-model" pointer-events="none" opacity=".7">'+
      '<path d="M'+(torsoX+13)+' 188 Q160 171 '+(torsoRight-13)+' 188" fill="none" stroke="'+primaryHighlight+'" stroke-width="3.5" opacity=".2" stroke-linecap="round"/>'+
      '<path d="M'+(torsoX+19)+' 207 Q'+(torsoX+31)+' 220 '+(torsoX+25)+' 238 M'+(torsoRight-19)+' 207 Q'+(torsoRight-31)+' 220 '+(torsoRight-25)+' 238" fill="none" stroke="'+primaryShadow+'" stroke-width="2.6" opacity=".24" stroke-linecap="round"/>'+
      '<path d="M160 202 Q154 226 159 '+(torsoBottom-14)+'" fill="none" stroke="'+primaryShadow+'" stroke-width="2.2" opacity=".18" stroke-linecap="round"/>'+
      '<path d="M'+(torsoX+25)+' '+(torsoBottom-17)+' Q160 '+(torsoBottom-9)+' '+(torsoRight-25)+' '+(torsoBottom-17)+'" fill="none" stroke="'+primaryHighlight+'" stroke-width="2.4" opacity=".16" stroke-linecap="round"/>'+
    '</g>'
  )
}

function bottomSurfaceSvg(
  primaryHighlight,
  primaryShadow,
  secondaryHighlight
) {
  return (
    '<g class="brute-bottom-model" pointer-events="none">'+
      '<path d="M121 290 Q136 299 150 294 M170 294 Q184 299 199 290" fill="none" stroke="'+secondaryHighlight+'" stroke-width="2.5" opacity=".24" stroke-linecap="round"/>'+
      '<path d="M128 309 Q139 315 149 311 M171 311 Q181 315 192 309" fill="none" stroke="'+primaryShadow+'" stroke-width="2.2" opacity=".22" stroke-linecap="round"/>'+
      '<path d="M119 276 L148 276 M172 276 L201 276" stroke="'+primaryHighlight+'" stroke-width="2.2" opacity=".2" stroke-linecap="round"/>'+
    '</g>'
  )
}

function weaponSvg(weapon) {
  const id =
    String(
      weapon?.id ||
      ''
    )

  const stroke =
    '#171717'

  if (!id || id === 'fists') {
    return ''
  }

  if (id === 'olympic_bar') {
    return '<g class="brute-weapon-shape" transform="rotate(-28)">'+
      '<rect x="-7" y="-80" width="14" height="160" rx="5" fill="#aeb7c3" stroke="'+stroke+'" stroke-width="4"/>'+
      '<path d="M-2 -72 V72" stroke="#e8edf2" stroke-width="3" opacity=".55"/>'+
      '<g stroke="#626b78" stroke-width="2.2" opacity=".72"><path d="M-7 -28 H7"/><path d="M-7 -20 H7"/><path d="M-7 -12 H7"/><path d="M-7 12 H7"/><path d="M-7 20 H7"/><path d="M-7 28 H7"/></g>'+
      '<rect x="-24" y="-74" width="48" height="13" rx="4" fill="#4a5360" stroke="'+stroke+'" stroke-width="4"/>'+
      '<rect x="-24" y="61" width="48" height="13" rx="4" fill="#4a5360" stroke="'+stroke+'" stroke-width="4"/>'+
      '<rect x="-18" y="-70" width="36" height="4" rx="2" fill="#7b8593" opacity=".7"/>'+
      '<rect x="-18" y="65" width="36" height="4" rx="2" fill="#7b8593" opacity=".7"/>'+
    '</g>'
  }

  if (id === 'kettlebell') {
    return '<g class="brute-weapon-shape">'+
      '<path d="M-18 -17 Q-18 -45 0 -45 Q18 -45 18 -17" fill="none" stroke="'+stroke+'" stroke-width="9"/>'+
      '<path d="M-14 -18 Q-14 -38 0 -38 Q14 -38 14 -18" fill="none" stroke="#747d88" stroke-width="4" opacity=".75"/>'+
      '<path d="M-30 -8 Q0 -27 30 -8 L24 33 Q0 52 -24 33Z" fill="#414955" stroke="'+stroke+'" stroke-width="5"/>'+
      '<path d="M-21 -1 Q0 -14 21 -1" fill="none" stroke="#6d7683" stroke-width="4" opacity=".7"/>'+
      '<ellipse cx="-7" cy="7" rx="8" ry="16" fill="#8a939f" opacity=".22"/>'+
      '<path d="M-13 29 Q0 38 13 29" fill="none" stroke="#262c34" stroke-width="3" opacity=".8"/>'+
    '</g>'
  }

  if (id === 'plate20') {
    return '<g class="brute-weapon-shape">'+
      '<circle r="35" fill="#29313d" stroke="'+stroke+'" stroke-width="5"/>'+
      '<circle r="28" fill="none" stroke="#515c69" stroke-width="3"/>'+
      '<circle r="15" fill="#c4ccd5" stroke="'+stroke+'" stroke-width="4"/>'+
      '<circle r="8" fill="#6b7480" stroke="#252b31" stroke-width="3"/>'+
      '<path d="M-21 -22 A30 30 0 0 1 20 -22" fill="none" stroke="#788392" stroke-width="4" opacity=".75"/>'+
      '<path d="M-22 20 A30 30 0 0 0 21 20" fill="none" stroke="#171c23" stroke-width="4" opacity=".7"/>'+
      '<text x="0" y="-19" text-anchor="middle" fill="#9aa4b0" font-size="8" font-weight="900">20</text>'+
    '</g>'
  }

  if (id === 'belt') {
    return '<g class="brute-weapon-shape" transform="rotate(-18)">'+
      '<path d="M-10 -72 Q18 -23 5 66" fill="none" stroke="#603923" stroke-width="15" stroke-linecap="round"/>'+
      '<path d="M-7 -69 Q19 -22 8 62" fill="none" stroke="#9d6845" stroke-width="4" stroke-linecap="round" opacity=".68"/>'+
      '<path d="M-5 -60 Q16 -21 8 55" fill="none" stroke="#39241a" stroke-width="2" stroke-dasharray="5 6" opacity=".6"/>'+
      '<rect x="-18" y="-12" width="32" height="25" rx="4" fill="#cf9d34" stroke="'+stroke+'" stroke-width="4"/>'+
      '<rect x="-10" y="-5" width="16" height="11" rx="2" fill="none" stroke="#7d5c1f" stroke-width="3"/>'+
    '</g>'
  }

  if (id === 'chalk') {
    return '<g class="brute-weapon-shape">'+
      '<rect x="-25" y="-29" width="50" height="57" rx="8" fill="#f0eee6" stroke="'+stroke+'" stroke-width="5"/>'+
      '<path d="M-20 -12 Q0 -21 20 -12" fill="none" stroke="#c8c5bc" stroke-width="4"/>'+
      '<path d="M-17 14 Q0 20 17 14" fill="none" stroke="#d8d4ca" stroke-width="3"/>'+
      '<path d="M-16 -24 H16" stroke="#ffffff" stroke-width="3" opacity=".7"/>'+
      '<g fill="#fff" opacity=".82"><circle cx="29" cy="-19" r="6"/><circle cx="36" cy="-5" r="4"/><circle cx="27" cy="7" r="5"/><circle cx="-31" cy="-8" r="3.5"/></g>'+
    '</g>'
  }

  if (id === 'straps') {
    return '<g class="brute-weapon-shape">'+
      '<path d="M0 -62 Q31 -31 8 5 Q-14 39 19 65" fill="none" stroke="#553529" stroke-width="13" stroke-linecap="round"/>'+
      '<path d="M-4 -61 Q-33 -31 -9 4 Q13 39 -20 64" fill="none" stroke="#8f6048" stroke-width="8" stroke-linecap="round"/>'+
      '<path d="M2 -58 Q26 -29 5 4 Q-12 36 16 61" fill="none" stroke="#b17a5b" stroke-width="2.5" stroke-dasharray="4 5" opacity=".75"/>'+
      '<path d="M-6 -57 Q-29 -30 -7 4 Q11 35 -17 60" fill="none" stroke="#c18c6c" stroke-width="2.2" stroke-dasharray="4 5" opacity=".7"/>'+
    '</g>'
  }

  return '<circle r="24" fill="#777" stroke="'+stroke+'" stroke-width="5"/>'
}

function fistIconSvg() {
  return '<g class="brute-weapon-shape brute-weapon-fist">'+
    '<path d="M-34 -2 Q-34 -24 -19 -27 Q-8 -31 -2 -22 Q5 -31 16 -27 Q30 -24 30 -8 L31 12 Q28 34 4 40 Q-20 35 -30 18Z" fill="#d39a72" stroke="#171717" stroke-width="6"/>'+
    '<rect x="-29" y="-27" width="17" height="30" rx="8" fill="#e8b98f" stroke="#171717" stroke-width="5"/>'+
    '<rect x="-12" y="-31" width="17" height="31" rx="8" fill="#efc39b" stroke="#171717" stroke-width="5"/>'+
    '<rect x="5" y="-29" width="17" height="30" rx="8" fill="#e8b98f" stroke="#171717" stroke-width="5"/>'+
    '<path d="M-28 11 Q-7 2 22 10" fill="none" stroke="#9d684d" stroke-width="4" opacity=".65"/>'+
  '</g>'
}

function petShapeSvg(pet) {
  const id =
    String(
      pet?.id ||
      'gym_rat'
    )

  const stroke =
    '#171717'

  if (id === 'gym_rat') {
    return '<g class="brute-pet-shape brute-pet-rat">'+
      '<path d="M-39 13 Q-35 -24 -7 -35 Q25 -38 40 -4 Q41 31 8 39 Q-26 41 -39 13Z" fill="#8d837c" stroke="'+stroke+'" stroke-width="6"/>'+
      '<circle cx="-18" cy="-31" r="12" fill="#bfa9a1" stroke="'+stroke+'" stroke-width="5"/>'+
      '<circle cx="9" cy="-35" r="12" fill="#bfa9a1" stroke="'+stroke+'" stroke-width="5"/>'+
      '<circle cx="-12" cy="-2" r="4" fill="#151515"/><circle cx="13" cy="-4" r="4" fill="#151515"/>'+
      '<path d="M0 7 Q6 12 0 16 Q-6 12 0 7Z" fill="#df7d83" stroke="'+stroke+'" stroke-width="3"/>'+
      '<path d="M39 14 Q72 6 66 32 Q61 48 47 42" fill="none" stroke="#d99ca2" stroke-width="7" stroke-linecap="round"/>'+
    '</g>'
  }

  if (id === 'chalk_goblin') {
    return '<g class="brute-pet-shape brute-pet-goblin">'+
      '<path d="M-33 -22 L-50 -39 L-43 -4 Q-45 29 -9 40 Q30 39 42 8 L49 -39 L29 -23 Q3 -43 -33 -22Z" fill="#86a94c" stroke="'+stroke+'" stroke-width="6"/>'+
      '<path d="M-20 -4 L-5 -9 L-12 3Z M14 -8 L28 -2 L18 5Z" fill="#fff0c4" stroke="'+stroke+'" stroke-width="3"/>'+
      '<circle cx="-11" cy="-2" r="3" fill="#131313"/><circle cx="20" cy="1" r="3" fill="#131313"/>'+
      '<path d="M-7 18 Q7 25 20 15" fill="none" stroke="#5d6b32" stroke-width="4"/>'+
      '<g fill="#fff" opacity=".72"><circle cx="-40" cy="28" r="7"/><circle cx="-28" cy="38" r="5"/><circle cx="40" cy="31" r="6"/></g>'+
    '</g>'
  }

  if (id === 'rack_hound') {
    return '<g class="brute-pet-shape brute-pet-hound">'+
      '<path d="M-38 -4 Q-30 -35 0 -35 Q31 -34 38 -2 L35 29 Q8 43 -20 34 Q-40 25 -38 -4Z" fill="#9f6d47" stroke="'+stroke+'" stroke-width="6"/>'+
      '<path d="M-28 -28 L-46 -45 L-43 -6Z M26 -29 L46 -45 L42 -6Z" fill="#70482f" stroke="'+stroke+'" stroke-width="6"/>'+
      '<path d="M-12 7 Q0 -2 13 7 L8 20 Q0 26 -8 20Z" fill="#2b2624" stroke="'+stroke+'" stroke-width="4"/>'+
      '<circle cx="-14" cy="-7" r="4" fill="#111"/><circle cx="16" cy="-7" r="4" fill="#111"/>'+
      '<path d="M31 25 Q50 14 62 28" fill="none" stroke="#70482f" stroke-width="8" stroke-linecap="round"/>'+
    '</g>'
  }

  if (id === 'mini_spotter') {
    return '<g class="brute-pet-shape brute-pet-spotter">'+
      '<circle cx="0" cy="-31" r="17" fill="#e4b18d" stroke="'+stroke+'" stroke-width="5"/>'+
      '<path d="M-24 -7 Q0 -19 24 -7 L20 27 Q0 39 -20 27Z" fill="#2f405d" stroke="'+stroke+'" stroke-width="6"/>'+
      '<path d="M-22 2 L-41 21 M22 2 L41 21" stroke="#e4b18d" stroke-width="11" stroke-linecap="round"/>'+
      '<path d="M-12 28 L-18 45 M12 28 L18 45" stroke="#30363d" stroke-width="12" stroke-linecap="round"/>'+
      '<path d="M-18 -38 Q0 -50 18 -38" fill="#503829" stroke="'+stroke+'" stroke-width="5"/>'+
    '</g>'
  }

  return '<g class="brute-pet-shape brute-pet-plate">'+
    '<circle r="40" fill="#d9b62f" stroke="'+stroke+'" stroke-width="7"/>'+
    '<circle r="15" fill="#4e5662" stroke="'+stroke+'" stroke-width="5"/>'+
    '<path d="M-20 -18 A29 29 0 0 1 20 -18" fill="none" stroke="#f0d96f" stroke-width="5"/>'+
    '<circle cx="-12" cy="3" r="3.5" fill="#171717"/><circle cx="12" cy="3" r="3.5" fill="#171717"/>'+
    '<path d="M-10 17 Q0 23 10 17" fill="none" stroke="#171717" stroke-width="3.5"/>'+
  '</g>'
}

export function renderWeaponIconSvg(
  weaponInput,
  options = {}
) {
  const weapon =
    typeof weaponInput === 'string'
      ? { id:weaponInput }
      : (
          weaponInput ||
          { id:'fists' }
        )

  const id =
    String(
      weapon.id ||
      'fists'
    )

  const category =
    String(
      weapon.category ||
      options.category ||
      (
        id === 'olympic_bar' ||
        id === 'kettlebell' ||
        id === 'plate20'
          ? 'heavy'
          : id === 'belt' ||
            id === 'straps'
            ? 'flexible'
            : id === 'chalk'
              ? 'ranged'
              : 'unarmed'
      )
    )

  const accent =
    category === 'heavy'
      ? '#f29a38'
      : category === 'flexible'
        ? '#8e6ad8'
        : category === 'ranged'
          ? '#55b8c9'
          : '#d66f50'

  const shape =
    id === 'fists'
      ? fistIconSvg()
      : weaponSvg({
          ...weapon,
          id,
        })

  return '<svg class="ga-weapon-icon '+String(options.className || '')+'" data-weapon-id="'+id+'" data-category="'+category+'" viewBox="-70 -70 140 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    (
      options.bare
        ? ''
        : '<circle r="61" fill="#161b23" stroke="'+accent+'" stroke-width="4"/><circle r="51" fill="none" stroke="'+accent+'" stroke-width="2" opacity=".24"/>'
    )+
    '<g transform="scale(.72)">'+shape+'</g>'+
  '</svg>'
}

export function renderSkillIconSvg(
  skillId,
  options = {}
) {
  const id =
    String(
      skillId ||
      ''
    )

  const glyphs = {
    leg_drive:'<path d="M-8 -39 Q8 -24 1 -4 L-13 18 L13 39" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M-21 13 L9 13" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
    arch:'<path d="M-42 29 Q0 -38 42 29" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/><path d="M-31 27 L-31 4 M31 27 L31 4" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    lockout:'<path d="M0 -43 L34 -28 L29 11 Q23 35 0 46 Q-23 35 -29 11 L-34 -28Z" fill="none" stroke="currentColor" stroke-width="8"/><path d="M-15 2 L-2 16 L19 -11" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
    pause_bench:'<rect x="-29" y="-39" width="18" height="78" rx="5" fill="currentColor"/><rect x="11" y="-39" width="18" height="78" rx="5" fill="currentColor"/>',
    grind:'<path d="M5 -44 Q-24 -14 -3 4 Q-31 18 -10 43 Q26 35 30 5 Q32 -19 5 -44Z" fill="currentColor"/><path d="M5 -19 Q-6 -4 3 6 Q-10 15 -1 27 Q14 18 14 3 Q14 -8 5 -19Z" fill="#171717"/>',
  }

  return '<svg class="ga-skill-icon '+String(options.className || '')+'" viewBox="-56 -56 112 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    '<circle r="48" fill="#191f2b" stroke="currentColor" stroke-width="4"/>'+
    '<g>'+(
      glyphs[id] ||
      '<path d="M0 -35 L10 -10 L36 0 L10 10 L0 35 L-10 10 L-36 0 L-10 -10Z" fill="currentColor"/>'
    )+'</g>'+
  '</svg>'
}

export function renderBruteSvg(
  input = {},
  options = {}
) {
  const a =
    normalizeAppearance(input)

  const bodyId =
    idx(
      a.body,
      BRUTE_PARTS.bodies.length
    )

  const metrics =
    bodyMetrics(bodyId)

  const skin =
    BRUTE_PARTS.skins[
      idx(
        a.skin,
        BRUTE_PARTS.skins.length
      )
    ]

  const hair =
    BRUTE_PARTS.hairColors[
      idx(
        a.hairColor,
        BRUTE_PARTS.hairColors.length
      )
    ]

  const primary =
    safeColor(
      a.colors[0],
      '#7c3aed'
    )

  const secondary =
    safeColor(
      a.colors[1],
      '#111827'
    )

  const skinShadow =
    mixColor(
      skin,
      '#5a2f28',
      .34
    )

  const skinHighlight =
    mixColor(
      skin,
      '#ffffff',
      .34
    )

  const hairHighlight =
    mixColor(
      hair,
      '#ffffff',
      .32
    )

  const primaryHighlight =
    mixColor(
      primary,
      '#ffffff',
      .28
    )

  const primaryShadow =
    mixColor(
      primary,
      '#000000',
      .25
    )

  const secondaryHighlight =
    mixColor(
      secondary,
      '#ffffff',
      .24
    )

  const shoe =
    mixColor(
      secondary,
      '#ffffff',
      .58
    )

  const center = 160

  const torsoX =
    center -
    metrics.shoulder / 2

  const torsoRight =
    center +
    metrics.shoulder / 2

  const torsoBottom =
    176 +
    metrics.torsoH

  const waistLeft =
    center -
    metrics.waist / 2

  const waistRight =
    center +
    metrics.waist / 2

  const neckX =
    center -
    metrics.neckW / 2

  const mirror =
    options.side === 'left'
      ? 'translate(320 0) scale(-1 1)'
      : ''

  const label =
    String(
      options.label ||
      ''
    ).replaceAll(
      '"',
      '&quot;'
    )

  const weapon =
    options.weapon

  const pet =
    options.pet

  const armLeftX =
    torsoX + 5

  const armRightX =
    torsoRight - 5

  const headTransform =
    metrics.headScale === 1
      ? ''
      : 'translate('+
        center+' 104) scale('+
        metrics.headScale+') translate(-'+
        center+' -104)'

  const fightModel =
    String(
      options.className ||
      ''
    ).split(/\s+/).includes(
      'fight-model'
    )

  const weaponAnchorX =
    fightModel
      ? armRightX + 32
      : armRightX + 26

  const weaponAnchorY =
    fightModel
      ? 176
      : 249

  const fightWeaponPose =
    fightModel
      ? (
          weapon?.id === 'olympic_bar'
            ? ' rotate(9) translate(1 -8) scale(1.10)'
            : weapon?.id === 'kettlebell'
              ? ' rotate(-12) translate(2 5) scale(1.13)'
              : weapon?.id === 'plate20'
                ? ' rotate(-7) translate(0 3) scale(1.12)'
                : weapon?.id === 'belt'
                  ? ' rotate(12) translate(1 4) scale(1.10)'
                  : weapon?.id === 'chalk'
                    ? ' translate(2 -7) scale(.94)'
                    : weapon?.id === 'straps'
                      ? ' rotate(9) translate(1 5) scale(1.11)'
                      : ' scale(1.08)'
        )
      : ' scale(1.05)'

  const weaponMarkup =
    weapon
      ? '<g class="brute-limb brute-weapon weapon-'+String(weapon.id || 'fists')+' category-'+String(weapon.category || 'unarmed')+'" data-brute-part="weapon" data-weapon-id="'+String(weapon.id || 'fists')+'" data-weapon-category="'+String(weapon.category || 'unarmed')+'" transform="translate('+weaponAnchorX+' '+weaponAnchorY+')'+fightWeaponPose+'">'+
          weaponSvg(weapon)+
        '</g>'
      : ''

  const petMarkup =
    pet
      ? '<g class="brute-pet" data-brute-part="pet" transform="translate(262 315) scale(.62)">'+
          petShapeSvg(pet)+
        '</g>'
      : ''

  const fightLeftFistX =
    armLeftX + 27

  const fightRightFistX =
    armRightX + 31

  const fightFistRadius =
    Math.max(
      15,
      metrics.armW * .62
    )

  const armLeftMarkup =
    fightModel
      ? '<g class="brute-limb brute-arm brute-arm-left brute-arm-guard" data-brute-part="arm-left">'+
          '<path d="M'+armLeftX+' 188 Q'+(armLeftX-15)+' 205 '+(armLeftX-11)+' 214 Q'+(armLeftX+5)+' 201 '+fightLeftFistX+' 176" fill="none" stroke="#171717" stroke-width="'+(metrics.armW+12)+'" stroke-linecap="round" stroke-linejoin="round"/>'+
          '<path d="M'+armLeftX+' 188 Q'+(armLeftX-15)+' 205 '+(armLeftX-11)+' 214 Q'+(armLeftX+5)+' 201 '+fightLeftFistX+' 176" fill="none" stroke="'+skin+'" stroke-width="'+(metrics.armW+5)+'" stroke-linecap="round" stroke-linejoin="round"/>'+
          '<path d="M'+(armLeftX+1)+' 188 Q'+(armLeftX-8)+' 202 '+(armLeftX-6)+' 208" fill="none" stroke="'+skinHighlight+'" stroke-width="3" stroke-linecap="round" opacity=".28"/>'+
          '<circle cx="'+fightLeftFistX+'" cy="172" r="'+fightFistRadius+'" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
          '<path d="M'+(fightLeftFistX-8)+' 170 Q'+fightLeftFistX+' 164 '+(fightLeftFistX+8)+' 170" fill="none" stroke="'+skinShadow+'" stroke-width="2.6" opacity=".45"/>'+
          '<path d="M'+(fightLeftFistX-10)+' 176 Q'+fightLeftFistX+' 181 '+(fightLeftFistX+10)+' 176" fill="none" stroke="'+secondary+'" stroke-width="5.5" opacity=".92" stroke-linecap="round"/>'+
          '<path d="M'+(fightLeftFistX-8)+' 168 L'+(fightLeftFistX-3)+' 166 M'+fightLeftFistX+' 166 L'+(fightLeftFistX+4)+' 165 M'+(fightLeftFistX+7)+' 167 L'+(fightLeftFistX+10)+' 168" stroke="'+skinHighlight+'" stroke-width="2" opacity=".42" stroke-linecap="round"/>'+
        '</g>'
      : '<g class="brute-limb brute-arm brute-arm-left" data-brute-part="arm-left">'+
          '<path d="M'+armLeftX+' 187 Q'+(armLeftX-38-metrics.armW*.15)+' 192 '+(armLeftX-31)+' 238 Q'+(armLeftX-23)+' 261 '+(armLeftX-9)+' 249 L'+(armLeftX+metrics.armW)+' 204Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
          '<path d="M'+(armLeftX-30)+' 238 Q'+(armLeftX-16)+' 246 '+(armLeftX-8)+' 251" fill="none" stroke="'+skinShadow+'" stroke-width="3" opacity=".45"/>'+
          '<circle cx="'+(armLeftX-26)+'" cy="249" r="'+Math.max(16,metrics.armW*.64)+'" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
        '</g>'

  const armRightMarkup =
    fightModel
      ? '<g class="brute-limb brute-arm brute-arm-right brute-arm-lead" data-brute-part="arm-right">'+
          '<path d="M'+armRightX+' 188 Q'+(armRightX+21)+' 196 '+(armRightX+22)+' 210 Q'+(armRightX+27)+' 194 '+fightRightFistX+' 176" fill="none" stroke="#171717" stroke-width="'+(metrics.armW+12)+'" stroke-linecap="round" stroke-linejoin="round"/>'+
          '<path d="M'+armRightX+' 188 Q'+(armRightX+21)+' 196 '+(armRightX+22)+' 210 Q'+(armRightX+27)+' 194 '+fightRightFistX+' 176" fill="none" stroke="'+skin+'" stroke-width="'+(metrics.armW+5)+'" stroke-linecap="round" stroke-linejoin="round"/>'+
          '<path d="M'+(armRightX+2)+' 188 Q'+(armRightX+17)+' 197 '+(armRightX+17)+' 205" fill="none" stroke="'+skinHighlight+'" stroke-width="3" stroke-linecap="round" opacity=".28"/>'+
          '<circle cx="'+fightRightFistX+'" cy="171" r="'+fightFistRadius+'" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
          '<path d="M'+(fightRightFistX-8)+' 169 Q'+fightRightFistX+' 163 '+(fightRightFistX+8)+' 169" fill="none" stroke="'+skinShadow+'" stroke-width="2.6" opacity=".45"/>'+
          '<path d="M'+(fightRightFistX-10)+' 175 Q'+fightRightFistX+' 180 '+(fightRightFistX+10)+' 175" fill="none" stroke="'+primary+'" stroke-width="5.5" opacity=".92" stroke-linecap="round"/>'+
          '<path d="M'+(fightRightFistX-8)+' 167 L'+(fightRightFistX-3)+' 165 M'+fightRightFistX+' 165 L'+(fightRightFistX+4)+' 164 M'+(fightRightFistX+7)+' 166 L'+(fightRightFistX+10)+' 167" stroke="'+skinHighlight+'" stroke-width="2" opacity=".42" stroke-linecap="round"/>'+
        '</g>'
      : '<g class="brute-limb brute-arm brute-arm-right" data-brute-part="arm-right">'+
          '<path d="M'+armRightX+' 187 Q'+(armRightX+38+metrics.armW*.15)+' 192 '+(armRightX+31)+' 238 Q'+(armRightX+23)+' 261 '+(armRightX+9)+' 249 L'+(armRightX-metrics.armW)+' 204Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
          '<path d="M'+(armRightX+30)+' 238 Q'+(armRightX+16)+' 246 '+(armRightX+8)+' 251" fill="none" stroke="'+skinShadow+'" stroke-width="3" opacity=".45"/>'+
          '<circle cx="'+(armRightX+26)+'" cy="249" r="'+Math.max(16,metrics.armW*.64)+'" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
        '</g>'

  const legLeftMarkup =
    fightModel
      ? '<g class="brute-limb brute-leg brute-leg-left brute-leg-rear" data-brute-part="leg-left">'+
          '<path d="M'+(center-metrics.thighW-1)+' 282 L'+(center-7)+' 284 L'+(center-25)+' 329 L'+(center-metrics.thighW-30)+' 340Z" fill="'+skin+'" stroke="#171717" stroke-width="5" stroke-linejoin="round"/>'+
          '<path d="M'+(center-metrics.thighW-40)+' 337 Q'+(center-metrics.thighW-13)+' 328 '+(center-20)+' 334 Q'+(center-14)+' 339 '+(center-17)+' 350 Q'+(center-20)+' 356 '+(center-metrics.thighW-48)+' 357 Q'+(center-metrics.thighW-60)+' 355 '+(center-metrics.thighW-60)+' 349 Q'+(center-metrics.thighW-58)+' 341 '+(center-metrics.thighW-40)+' 337Z" fill="'+shoe+'" stroke="#171717" stroke-width="5" stroke-linejoin="round"/>'+
          '<path d="M'+(center-metrics.thighW-11)+' 292 L'+(center-19)+' 327" fill="none" stroke="'+skinHighlight+'" stroke-width="3" opacity=".22" stroke-linecap="round"/>'+
          '<path d="M'+(center-31)+' 337 Q'+(center-43)+' 344 '+(center-54)+' 346" fill="none" stroke="'+primaryShadow+'" stroke-width="3" opacity=".42" stroke-linecap="round"/>'+
          '<path d="M'+(center-37)+' 351 L'+(center-57)+' 354" stroke="#171717" stroke-width="3" opacity=".75" stroke-linecap="round"/>'+
        '</g>'
      : '<g class="brute-limb brute-leg brute-leg-left" data-brute-part="leg-left">'+
          '<path d="M'+(center-metrics.thighW-4)+' 284 L'+(center-5)+' 284 L'+(center-10)+' 337 L'+(center-metrics.thighW-7)+' 337Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
          '<path d="M'+(center-metrics.thighW-18)+' 335 Q'+(center-metrics.thighW+5)+' 325 '+(center-5)+' 335 Q'+(center+1)+' 340 '+(center-7)+' 354 L'+(center-metrics.thighW-23)+' 356 Q'+(center-metrics.thighW-34)+' 352 '+(center-metrics.thighW-18)+' 335Z" fill="'+shoe+'" stroke="#171717" stroke-width="5" stroke-linejoin="round"/>'+
        '</g>'

  const legRightMarkup =
    fightModel
      ? '<g class="brute-limb brute-leg brute-leg-right brute-leg-lead" data-brute-part="leg-right">'+
          '<path d="M'+(center+4)+' 284 L'+(center+metrics.thighW+5)+' 281 L'+(center+metrics.thighW+29)+' 327 L'+(center+21)+' 337Z" fill="'+skin+'" stroke="#171717" stroke-width="5" stroke-linejoin="round"/>'+
          '<path d="M'+(center+15)+' 334 Q'+(center+metrics.thighW+15)+' 326 '+(center+metrics.thighW+43)+' 334 Q'+(center+metrics.thighW+59)+' 339 '+(center+metrics.thighW+61)+' 348 Q'+(center+metrics.thighW+61)+' 355 '+(center+metrics.thighW+49)+' 357 L'+(center+20)+' 353 Q'+(center+15)+' 347 '+(center+15)+' 334Z" fill="'+shoe+'" stroke="#171717" stroke-width="5" stroke-linejoin="round"/>'+
          '<path d="M'+(center+13)+' 292 L'+(center+metrics.thighW+22)+' 324" fill="none" stroke="'+skinHighlight+'" stroke-width="3" opacity=".22" stroke-linecap="round"/>'+
          '<path d="M'+(center+31)+' 337 Q'+(center+43)+' 344 '+(center+54)+' 346" fill="none" stroke="'+primaryShadow+'" stroke-width="3" opacity=".42" stroke-linecap="round"/>'+
          '<path d="M'+(center+37)+' 351 L'+(center+57)+' 354" stroke="#171717" stroke-width="3" opacity=".75" stroke-linecap="round"/>'+
        '</g>'
      : '<g class="brute-limb brute-leg brute-leg-right" data-brute-part="leg-right">'+
          '<path d="M'+(center+5)+' 284 L'+(center+metrics.thighW+4)+' 284 L'+(center+metrics.thighW+7)+' 337 L'+(center+10)+' 337Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
          '<path d="M'+(center+6)+' 335 Q'+(center+metrics.thighW-5)+' 325 '+(center+metrics.thighW+18)+' 335 Q'+(center+metrics.thighW+34)+' 352 '+(center+metrics.thighW+23)+' 356 L'+(center+7)+' 354 Q'+(center-1)+' 340 '+(center+6)+' 335Z" fill="'+shoe+'" stroke="#171717" stroke-width="5" stroke-linejoin="round"/>'+
        '</g>'

  return '<svg class="ga-brute-svg chara-v3 cute-v4 '+String(options.className || '')+'" data-side="'+String(options.side || 'right')+'" data-body="'+bodyId+'" viewBox="0 0 320 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+label+'">'+
    '<g class="brute-stage" transform="'+mirror+'">'+
      '<ellipse class="brute-shadow" cx="160" cy="355" rx="'+(76+bodyId*4)+'" ry="14" fill="rgba(0,0,0,.2)"/>'+

      legLeftMarkup+

      legRightMarkup+

      '<g class="brute-bottom" data-brute-part="bottom">'+
        bottomSvg(
          a.bottom,
          primary,
          secondary,
          bodyId
        )+
        '<path d="M119 279 L150 279 M170 279 L201 279" stroke="'+secondaryHighlight+'" stroke-width="3.5" stroke-linecap="round" opacity=".34"/>'+
        bottomSurfaceSvg(
          primaryHighlight,
          primaryShadow,
          secondaryHighlight
        )+
      '</g>'+

      armLeftMarkup+

      armRightMarkup+

      '<g class="brute-torso" data-brute-part="torso">'+
        '<path d="M'+torsoX+' 180 Q'+center+' 145 '+torsoRight+' 180 Q'+(torsoRight-2)+' 227 '+waistRight+' '+torsoBottom+' L'+waistLeft+' '+torsoBottom+' Q'+(torsoX+2)+' 227 '+torsoX+' 180Z" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
        '<path d="M'+(torsoX+12)+' 188 Q'+center+' 171 '+(torsoRight-12)+' 188" fill="none" stroke="'+skinShadow+'" stroke-width="3.5" opacity=".45"/>'+
        '<path d="M'+center+' 189 L'+center+' '+(torsoBottom-7)+'" stroke="'+skinShadow+'" stroke-width="3" opacity=".3"/>'+
        '<path d="M'+(torsoX+18)+' 198 Q'+(torsoX+28)+' 211 '+(torsoX+23)+' 231 M'+(torsoRight-18)+' 198 Q'+(torsoRight-28)+' 211 '+(torsoRight-23)+' 231" fill="none" stroke="'+skinShadow+'" stroke-width="2.4" opacity=".25"/>'+
        '<path d="M'+(torsoX+20)+' 184 Q'+center+' 165 '+(torsoRight-20)+' 184" fill="none" stroke="'+skinHighlight+'" stroke-width="3" opacity=".25"/>'+
        topSvg(
          a.top,
          primary,
          secondary,
          skin,
          torsoX,
          metrics.shoulder,
          torsoBottom
        )+
        torsoSurfaceSvg(
          a.top,
          bodyId,
          primaryShadow,
          primaryHighlight,
          skinShadow,
          skinHighlight,
          torsoX,
          torsoRight,
          torsoBottom
        )+
        (
          a.top !== 3
            ? '<path d="M'+(torsoX+14)+' 188 Q'+center+' 171 '+(torsoRight-14)+' 188" fill="none" stroke="'+primaryHighlight+'" stroke-width="4" opacity=".34"/>'+
              '<path d="M'+(waistLeft+8)+' '+(torsoBottom-9)+' L'+(waistRight-8)+' '+(torsoBottom-9)+'" stroke="'+primaryShadow+'" stroke-width="4" opacity=".28"/>'
            : ''
        )+
      '</g>'+

      '<g class="brute-neck" data-brute-part="neck">'+
        '<rect x="'+neckX+'" y="139" width="'+metrics.neckW+'" height="45" rx="12" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
        '<path d="M'+(neckX+5)+' 149 Q'+center+' 159 '+(neckX+metrics.neckW-5)+' 149" fill="none" stroke="'+skinShadow+'" stroke-width="3" opacity=".28"/>'+
      '</g>'+

      '<g class="brute-head" data-brute-part="head" transform="'+headTransform+'">'+
        headShapeSvg(
          a.head,
          skin
        )+
        '<path d="M122 122 Q133 146 153 151 M198 122 Q187 146 167 151" fill="none" stroke="'+skinShadow+'" stroke-width="3" opacity=".26"/>'+
        '<path d="M126 77 Q146 61 166 62" fill="none" stroke="'+skinHighlight+'" stroke-width="4" stroke-linecap="round" opacity=".28"/>'+
        '<path d="M112 106 Q99 100 101 118 Q105 132 117 128 M208 106 Q221 100 219 118 Q215 132 203 128" fill="'+skin+'" stroke="#171717" stroke-width="5"/>'+
        '<path d="M105 113 Q111 110 115 119 M215 113 Q209 110 205 119" fill="none" stroke="'+skinShadow+'" stroke-width="2.5" opacity=".4"/>'+
        faceModelSvg(
          bodyId,
          hair,
          skinShadow,
          skinHighlight,
          fightModel
        )+
        cheekSvg(
          skin
        )+
        '<g data-brute-part="eyes">'+
          eyesSvg(a.eyes)+
          eyeLifeSvg(a.eyes)+
        '</g>'+
        '<g data-brute-part="nose">'+
          noseSvg(
            a.nose,
            skinShadow
          )+
        '</g>'+
        '<g data-brute-part="mouth">'+
          mouthSvg(a.mouth)+
        '</g>'+
        '<g data-brute-part="marking">'+
          markingSvg(
            a.marking,
            skin
          )+
        '</g>'+
        '<g data-brute-part="beard">'+
          beardSvg(
            a.beard,
            hair
          )+
        '</g>'+
        '<g data-brute-part="hair">'+
          hairSvg(
            a.hair,
            hair
          )+
          hairSheenSvg(
            a.hair,
            hairHighlight
          )+
        '</g>'+
      '</g>'+

      '<g data-brute-part="accessory">'+
        accessorySvg(
          a.acc,
          primary,
          secondary
        )+
      '</g>'+

      weaponMarkup+
      petMarkup+
    '</g>'+
  '</svg>'
}

export function renderPetSvg(
  pet,
  side = 'right'
) {
  const name =
    String(
      pet?.name ||
      'Familier'
    ).replaceAll(
      '"',
      '&quot;'
    )

  const mirror =
    side === 'left'
      ? 'translate(120 0) scale(-1 1)'
      : ''

  return '<svg class="ga-brute-pet-svg" data-side="'+side+'" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-label="'+name+'">'+
    '<g transform="'+mirror+'">'+
      '<ellipse cx="60" cy="103" rx="39" ry="8" fill="rgba(0,0,0,.17)"/>'+
      '<g transform="translate(60 64) scale(.82)">'+
        petShapeSvg(pet)+
      '</g>'+
    '</g>'+
  '</svg>'
}
