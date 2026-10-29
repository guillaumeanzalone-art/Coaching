import { supabase } from './supabase.js'

const RARITIES = {
  common: {
    label: 'Commune',
    short: 'C',
    rank: 1,
    costBias: 0,
    budget: 8,
  },
  uncommon: {
    label: 'Peu commune',
    short: 'U',
    rank: 2,
    costBias: 0,
    budget: 10,
  },
  rare: {
    label: 'Rare',
    short: 'R',
    rank: 3,
    costBias: 1,
    budget: 12,
  },
  ultra: {
    label: 'Ultra Rare',
    short: 'UR',
    rank: 4,
    costBias: 1,
    budget: 14,
  },
  secret: {
    label: 'Secret Rare',
    short: 'SR',
    rank: 5,
    costBias: 2,
    budget: 16,
  },
}

const ARCHETYPES = [
  {
    id: 'power',
    label: 'Puissance',
    icon: '◆',
    text: '+2 ATK si son coût est ≥ à la carte adverse.',
  },
  {
    id: 'guard',
    label: 'Ancrage',
    icon: '⬟',
    text: '+2 DEF pendant le duel.',
  },
  {
    id: 'tempo',
    label: 'Tempo',
    icon: '»',
    text: '+1 ATK et +1 DEF si le coût est ≤ 2.',
  },
  {
    id: 'technique',
    label: 'Technique',
    icon: '◇',
    text: '+1 ATK et +1 DEF contre une carte plus offensive que défensive.',
  },
  {
    id: 'chaos',
    label: 'Instinct',
    icon: '✦',
    text: 'Variation de -1 à +2 ATK à chaque duel.',
  },
]

const CHARACTER_DESIGNS = {
  louis: {
    family: 'psychic-lifter',
    sigil: 'Ψ',
    stages: {
      common: 'Force latente',
      uncommon: 'Éveil psychique',
      rare: 'Télékinésie',
      ultra: 'Œil astral',
      secret: 'Maître de la gravité',
    },
  },

  rudy: {
    family: 'psychic-savant',
    sigil: 'Ψ',
    stages: {
      common: 'Esprit analytique',
      uncommon: 'Focus psychique',
      rare: 'Télékinésie vectorielle',
      ultra: 'Cortex astral',
      secret: 'Singularité mentale',
    },
  },

  guillaume: {
    family: 'sovereign-lifter',
    sigil: '♛',
    stages: {
      common: 'Discipline',
      uncommon: 'Commandement',
      rare: 'Domination',
      ultra: 'Souverain',
      secret: 'Ascension',
    },
  },
}

const CHARACTER_CARD_ART = {
  rudy: {
    sprite: '/tcg/rudy-evolution.webp',
    rarityIndex: {
      common: 0,
      uncommon: 1,
      rare: 2,
      ultra: 3,
      secret: 4,
    },
  },

  guillaume: {
    sprite: 'data:image/webp;base64,UklGRoIdAABXRUJQVlA4IHYdAADQWgCdASrhAF0APrFGm0wnJCKiPB2K6OAWCWwAvkcWFQF5nS+UrzHkErZ7sHMf+O76HpI/u27855L0xf5nfeeii9aP/S2pNvg/WeA/iq+Afvvnd4S+prUL7o/5PmZ/3PBH4mahHsfzp/ruyv2D/b+gL7i/cf+54bmpT4K9gD+i/2r0v/0v7AeUX9+/2XsC/0j/Cf+n/Pe7J/jeQn619g39ievJ6RBWhyD6KGkY+utgfArZL5xJl83rHv39up96amy0Ol7XySSAR7VVmwenSqB+Wdx/cUXM9S/leUAY2MgXDXsiMY1+TIHzWdZpe3XIi325FVhEAqAfPyPiD7St7wDgAb3DrUYqTF5AY7JKlCdTiTWfBz+VChqh7bdbo8k4FMgkhr44W3rimDV+WXdzPU55ergw0YOwsAkOOFA4YgC0WYFrMya5EAjM3hDdoiZ1v1Sb0+U5KdzbAmBP5LhPzbsfUfwM6qGus6acNcCBRzAO0+lFxbGNPxZdUXyWYlcC41Q5sbvnivGjIc6Xzf5X05uGkdtGdguXvnUi4lWqhWCVDW9gWzp1x3mKH/IHPNmx5AN0gIxXt3FnRSbSlYRCIz9a1Qd/9lJD9aaKw675BqDCkdM4qwzCUryuB/9XCsLMbeoe7GP0lNa1X6X3KFWCAhe/PSkhblHX21cmvqD/ctwuxvRhLElcwSLSvUtunVmjY9Sev1p/73fuWV4OIm0ctESb9ixjPZIWI2BhcV59b9JtIC2XSN6ZKQEArcedB27docne+yAsOI5ScDkSWNjjnWlE9aHe/s98pGU3yZXg7KZ/xfWb3zp27YOe5UVbANI7Qw2M8RAFZ8WXH4dG2ztu2FYl8eypZntLZ8tFwNFXeD8n71HiSp14gqoMgXxGMZSly17aQvHBAV8BQLhwR3iMkHOn/aKOTdGgfgmev39X3ROua+BQ0x7O+qe62jO4Pv71BE/IddwHFDtdOQRubeEWWwAA/s0Vnlfe5ptWCqX3+pLkR5XGUZgcJopiLf/Y72uropBaphpKgQQa7psrHzoDcTh35NH1DQMpg0PJxBa+edarsentBIhuNo39BzEMRxA/3vrv1mvgjQ5DXPFQDyjcbKQWcEJrC6rp2AmxAJ2A5tx3V66sURuVbOJMQoW1SVHlDevfbLIcew4X5ROFKqjibQlQhl0WWxa3uOFgCJgaM8SlpYkmNPH6rT3HrHdH655ClTSMX0XW0aUVY/GhTqKUvFfvrhdGcrTVedMFUlGTwRAUroiO10TbLW2sRToSylQmCxOv0sIOk0hb6XMb487LskHGjgH7pSjhCa3ofiRQ0inS/SCwnUdPgukxg2GEu2m/0ZVy9I7DQxO7DbIO8riWYaNS4Ha5giy0sh57C106v3LLuSLZzAVaP2Ti4IhdY6slQOHAzg/XfiD0UGAmttkTwSXFiRcP7BQ7weGKrjYx2V0VhU3ZzT4G8sgVWyvOSuEC2RYH3W2AEbl3CDSbL5n+sSIHQo6jyWWV4d+6n44jhi6nJMmMJjs7tyUDlR3ukkppGQqIlsBZL+UbjZ2V/KBzb9xrH3pan24qaQuegY3BYE55ItMVV4a9vfnU1L2B4y2uS9onhftGANUX3X/IABmRNuuWd18BdHcjwxxCpG304mfJmyKi7Y+5CIZmnXEZctmlK1LUpbr+B15guUfPx30iWvryFzsUYtGq+Iwl7dEyj8E3j9rpy0XQ7kGUUGURqTuo5zx1THoRgQ4xbiB/mw+qgr/8L+7wQ2AY0zmSNBsz+iWOVmy27DlqA256VxkFYnJ/po4tb9G9o4a/ghRPPU07UMWpcYHOt4ff5EP0N1uGZWjYCDm8hNI69znamMZzlBPFae4xF87jUX74kUzI/XlsiK+iHPpYSb6l9tpJCozZW+tvCiJ7sPsG3YpsMMfTc9kgDO9vX1oeDohgRzuxM7BShKb+wOtYcky9n7RyKLucocGgYhs/fF2vHtFhvEdlsbs6mkN/uXfdI4Qe9loBkWsm3bZMci8vV6MtSzavKO0rj7UbDyC7dD7DwcQVOfPtBzvNUlcSJB46dh4tnkJLlXTUyTfjL9rv5NF3hF6I6PoKVGqc+CQDr30GivkUSuUkSV7foFHUOf+jfpxr1NkImGmHEUZVyr/U8KuF42oA1RcdvQZ3xTqcoplKex7LtipzQ4hVTIusg34MhJRWRtkVYCj9qibtAvH5Ea9qytdyJ8ILmerUDBaQ0avJ6Yle7LX9ASmo9R09V0jKxf6rHYssQEMvWHwSa45ZGHOyHUHF1hVwWyb/9dleTh1t6Cumzl06T38eh5mLidWkki+aIhtgxN0uqzGhoqUSLxhp+r1PRvWgIQ5ClplYwBSq579v8iqxYElkKfE0KiQIP4dyETIld/WDni7GUUGqHLfaa2d6vzwh+wzb7Q1Ut94bmuJhJpJ9D+UurmPhxOsq9M87t9rXoeC2G1LawHQnIueZvIZf+EV3GdeR1uJ9Bf5kidTncdhoRzttyYkcHSa5YKFMn2yPzxMiZbN6brJiFg0+i9FO/g0bUD+DU+579spFWrepI6bpZaW/aWGJSDgZOMH4zNYVhewaR4xW4Sp2OUJsNagNNjZmBleSuBsN5qCwvFrOtE9aED2ToTE/sCymF/VX6lWMx/drnx8EqgiYjxOo2PzQLvyq2Nzc0WNA2nDAlJkxUkvZpeWk/QKMpTimw6i9diq4k83izcCj6hqigATca/LmEL1p3Z54KXqUH2oZ88h8zb19WS5bEX2hNNIloxnw2Nb7/ql1U6xKxR9ID9JeWneguGHfuN7db9foQcKfawCH36Uy79NuPJv0Bc2DUPAjrkvNl0MpmfxU4udXyWD+KhsPW9XpGJNewV+GanGBTEpBj9VlFEAAVSzgH94E4X/l02yQaB2X/7UQeLpko/NAqtw6Xh6o95eOqarOwxwV6k69jAJom5PdJFsnKgnIfElUWpG+B6roSFmTMga2GLyx/AajkFeKLjejrjg+LdwsPhzxnAacyXrMD9e24aopPDsGsZWUVojOg9Yyj2f/536QtZG8YkN3uHg2CuSjsYsO2d0kjPsntbkQxESGLjnMvMASD+by2cHvlwyBoQiVECFA2i00Rj9gsD4+PcjyOre6SjDobcvzhrD82GkHz7cfLq7dhAfOSjexJ8JsrLObh70PmklEU2K+lj0mI9ZY7kuHEUF8nT22b/c9qmaNj8b7an3YGay4gcyWJr5rBvPHUi6YQzqt/3PB+KBfN08pF5eG7WzC0L53e095vSm2x7NZRmpH07+EkyBIkMLRpt5V8S5i0Wcqo/wXIWGXUWepnWOlppKtn+cqyBeiM+iq51a6/Mk4bCzUz6GN4fSFe1f4PpzUbS9yw/QzVBifvEo+esU1Lza02jfp5/KbyHG/rPgxUHGK+8aEEyOdDvho10R9zFcBvatLZ+5XEVbo0C1U/iNbqoRjLJfzfIliZ/I6A30TtDKjYXqj2N7IHb/ZnDc+qYD31R8IZRWxJj6J1PSqhi2zKvRlmIaSoFmpRXYLGbBgq2WK83EUlzLd6ZhlwVSlGrnzhAyk9f4/HLeeCxBM683jC+0VkqFsaZsH2UFWOCUUZw9HXk2iVVo9NHxySnwuAS0wfr8jHGZU9SGPeThGTT1ViIPhTmwEknpX9ioZqNCTR8x4OKX/B2CyThjgsXP/kbBn/2EmcPT3q5EMoP5G/wDMZut+XYU+E9iHmQNLHmXVbn4JZOZkefscGxZhLJl+HgJbG3Aa5JyiHgwQxdH8ndrre9kFxVUu8Jd3NKeIZN4r+Gn1+34wIO3pvI9lgYRig0nTJoUnHipGbUjYy+3CXK+zEm7lE27PHAJs+KGieMapiBiEr8hghKn+VlSIEkiECl0p0c1+zj608WOROut/39moHYs8sidJuNab9iNVFyU6F1a6QT0+1NVmMNwbrr3RlPgquvrrjZrz1RQMUsC2WxW4Y0MKc/RRMT0bkSdezIJHuQhu/gr9abiMI74YzTu92qA2epxI3WV3PlODiN+5NOVmr6+lmt2PfJQlZGNCxFhZr0coDcf0qocayeH0I4QNPWWFUTXKq3L6zRS+2sQHCb9McxKOYdiysEd508OLYnBV0qAis3m2zgEH4SSQ8iW6B02zj8c/V2be6dFsLK+33iAVbKMIMWkMvdbyT++SGVrPXAOJZ3UQZLD0p/hdMNi43GnCyPPbvSSd+nJfq8P2/INDupaGSIg9EYspvNiZZp+sdqABDeExDtTCudMOX4BGhYUtVYCwcWUDbOT858ii+1WgsXBUUpzJPYPA00CtUc4FPZkuK+URwdKq/MI8Pu8cX+U4DehSgWz3JTjI3tLAtyJvjPR3tr4V3q76tAjS7sGWZYsV0i6FiTwPKiTI+DKNO9NyJhs5gLQ8FwPZhWC6D1I8kjXCPBnKVD0ztx4eg642k2RrzqYVR+bYr2gaDvv/PoCRt2zlWXCqvSKIJxFv4iHiJlsbfkufVYUwT3Uxttknc5ePT5q8V6CFv08DqUk+Xjvojc/knDRClD02mgVgWkzXo7fJ8wgkNreJmz49C+NY7YnxFoiyhA4k8egx1nopq73qC77eD/kliQXf/QQuU8hEG10Cu4x3PtsvTMiiDBPP7xUTVvsiJnGrVL0EfRnG4GTHxwtOcAzhd0YYxu1SvbNXMWdLCxbjGsOGoKzE+kJCZAt5kzRKLFixjKJ8g7r3jRkT83ehNasD6hghSpsUtwUWDMVwTnJu/IzKyyI7rBwgWh5hlG/UQoF1we5IgYg7ZLoccCMVfecDREGH4DkZHomW3suvIw2fqNkGBqvAZPCzdlTAHQMBRh4CIIcunctbJOiUT34gkEaQg/gEtn14EELqIHm72QYhGGwQM3QEqA/gTvsnVnjBKy16vT+58o5su3dZFeXsmjBOI8PdnJp1aQUN20yEQO+0yLt/pdZYHLdIMhNL3tr9pdMlAmhX1hM1wr7Err27DchNg+Vhel5RJCNyt50NW9BThbQ4KOE8P8f0pLb4GbYZwoPSkr3RQYMCb9oUKL5CWyU2oAjiFLNTDt1cu+2SK912EZzavmJX1vbbTwxPRJecxSltS9XEQrL4/oQI09/Gi/bytbihpCRNfMHhekuM67IY4xzern7bl40HceiFYzSO14TP8UhtqEd4Y01LU0vynXRu/vvZ3GNktdYjH/11dbbkCKYg6MWU+Su64PgShQNOON1C6qpIwkI7uCcEHnBDPBS6/3pO96s3Ihy6Gg1A3OtjIbVywh6JTZ+C+yOgV5sJx+wfCNkgqXxk1L3WYSOZvfaz1o0lGMWFonAdGovbfQ0sIxE1Lqcgs9IwbuH6/2upFeWJqAz5bWHhWLkVdHO/8pJ1HoNjC2wPPO5OY5As+VTC3vk5OpNUaRQ4hQrVWxvaCXVpLE5p75tyOvEIG7nv4eH01B67j7bJG/XCLnnwAnEoH/jr7wB/DsrUK2s4NMSownm30qnQ0JHi0kVIuSaIQd36Bo71+R/jg1/himGbXvIPTRv6pg2MRjReO73Hykq/gAbXb6xU0HJ48q4Q9HQiQV01SFU2+Cr0vKKX1+FXOzywuV/dUa4EBE+vWSoC7bj+K0q0fCPo1z+lt4YLsvJNZPCFo/WWun3xLL3yTjeRZ+DEHy3+SFS4KFt6u9nDnRRe3mogGbKXSRz7rZOJG2GKYLPTIFWgOI0m3R4UGc4YfZFwheLVKTDNQXIxlP6mF5N/+wXogc7ROIknK52PvLZ6XqaWINhxavrUxnfNMOBMzxh2kHY0R4ZmgBDJQBhU2F5MzzzwG9O+HCNUMVQ/MSqi1jU2bcPiF4/TYo8wk+HQxGxXq0fQJL5PstT1L+uVVDO+FH6ocyHVuB/PuGtMhWgf0aVHZ1aI/jw1UBjV3fmc6LNfD9wY/isX34CMEUuWvJegZA0aYEnzoFVGyMsu2MQWhCbCmNBBm1xqPARWelIFkRGjuORKEI3Q4dd9W5bV2M23Va2EZ5P5tRHqJo/PNgsAWrDRC3Mik61HqyxLJcOPSx5u+2z+pXpS37o0HboYTn02IILWzCX9lG+p2hQuh2MNaOYOeE5jXCM6nVf0SPY64gvfeKIeSgsw+6IGaMTnFXI+sJqsPXrJKCSLB8MC6Jt3490CA6M1p4tz56pmU0TI7PeDM46Syl8fqctaG9Nwlmx+4GjjZ8yHxfebElJ9OCIOL4CPvgN9CpCyEM2lwISPhjT8Ymx8e97OZb6zYFqI6jtHT9NnBwtlsDIuT56kNQblb7YvWEJswyc8Lqhwj9ghYkOM4IshtsshZw+/XDM/DSFOgaognFePPXyK9FpF8GgMSUGBm5wZ03CwBsDBAYu4CZ5St7lmUtTLsVXRVKK1zfbS/cQ1L+JVoKlxydvDpj96ISoj5BKL6FGeaaQe6Y3ef+SbY3DjrfxW9HujLl2+RBhSNVaOlS1k6Akxd/p6yRy87lK2h3OlA3HZwfIthUYStXeow4vMtkgDaxowlGI+YA/TqM97xb7PDt1ohe0ngAF2eacjwckb94Toieb6r8CRGdu+yt9lXK6CA9FrQojKeDRcL6zp1u8L+WmzMQVdnEFnaSHTc5wBf7B3Pui30jFpvxryFMN308PQW7r6QkGzEYmsyV5KnvINaLDibxjZ/pg1XminPxoz3+FRk3+xAvLa4Vmk97c7isKT3lk17HaN9mJ72s5fgzI3eGVTio9heKc4Ngr/aljNDM4ZRgh4DGysGKayH/Nd8rHWUvtnVryD+7gIGyO9Kr13eRDm9V1q7if7BewtTTp5FLzUYAkU1/jah6eJUWtl4iHV+v9tXLDmZHUjf1UgK/pWJH+/nH+oJjR0TXVjXKatvtmJ6+JO2hs6ft2Ts00BcM9YboVks0DNDdfQ+dVcnIOhAjE+ZDz6vv8ww8u5EM3o/UJxAqOHLrwwE2AbbcjYokrmsOUfWpotH7ohFd50f0QoK6y6CBQ+FJfvg+YCnDfI9C2V9IPANoXHKnwWH2pFvBmxe7NNEDbYwKYRZ/3w5mKio0LxW9PJd+JcdXpg68YfBLSaJswU0/fd3jVfFc3LYwpgxIyvoSF7mJbvtpBCOkXdpvy2eYOKQVxXsFz6EYfhlH884zTJIDYXJMKs0LsAwTQAn18yZ74VDI3TN4gIbLTWWwmA0lwjgsX/s6Rv8fZ81jQnuqSfTVBbEnFIEpgMSBb262nek+lBWY73RkJ9KNkZoIaHivxy1lB4pQoPz99vc02z3PMh5aI0/wcSFxxKI8JVufe+jAStTFqrsR9uhEDNyY+h35Hdj9J9UcaRllcnsvFhFAIJIpz10cukJCE7S+zneX3Fa0BtvWnrkXF/yc9jUe9JKeiKga1CKzsn0ELR9l7EQh7WP6YDoavzmWiZFfBlEb43dnzlF91fLhBOSCqjUN6ytH1FeiEfgO/oqT+Dppl8LWfrx9sjs2QRMVZVYi5DX8cUJq1rD1QhErw5x/IyzszAautaq9j5dg39fWmlwhqJx7EHi0z0rCMANHKbGgnZU1qrSOut9CbeWNDu6fZWW37SHS2xEQCRNb8wa8f/Yevr/B7o3oeEHo6pCK6RE3/QaGejt0VZcKvVpDmymSgkfLGxPN46l4HiH3vGGsNCdR4qic3kHzrplU6j/73FhHnO1sZ6rezqMnj0ojUCZ5oFjtvqpuzhlOVQ8TKX+cJv6zsYKwXWHlIVFWG9ITfQM15zMmJtWW5dt04ibqzxqVla1qEndXNV8/YdaFGPueWte+9JMvKHyWqkSdDOf0WWIMPEr78QRu+3tt9EwM+8GKFqvvC6ANlYJQRX7MoHeGjVqbtGodICzJs9OvL4i9wEuiznmnV+bdrQHwyLeXKE0Axu55wvN1xv64r1qEUr3SyGYHixFlkvy8Oqp1JCqZkTq046LMENEOpKzs27BIiPzKaJJ2+AorgorrHmvTb5MBCOIfIWxIeS0d0xdH4rRs4I0ll7bSacIrUw2aOf2aUl4QchT0NmkkO3FGXNESbkHUSDF10xAkQqnlFUj5d0mQ3dG1o5ZPe3+d0KgZz+OWmXbg4lEcyMV/K9GINf5rySXJ2ZcOG9sozNFCsYkGlwqOtFxxTYrsVsGJ1TgSO0+IXu1cn0DeRDgW2OXeDN9AwvpxN8SsCBeK6lHT0RJCdJiYWNFgEa2kUKxXzvEUHIYeVIPBjelidwbkHfciF2Q1g2woM65dsMDeN9NlnJA/c7K1sV+nbSTJvEymhkyTVXdVmx8kaO+QQVomaOxm7COLk79o3aPrMopCO1nK03bOBxPTl+x3BrGrGMtGqBq/8V5X+gOo/ABbJ6OKgxBtSptcdy8CmvXjjEAGcVI5peoD0pGiUPt+o09BbK91cKSav1bxI1W90HlM6K194bg3XvYsMGZMfoXgyRuDxi5dU5SIJdN1nHzJICb9h74U36Pfu9z3PyCdcUXmnaPZhzD9NjtEdEGzetFTkY5mi8VUFj88I/yUgPQAwDk16baXnTrGYrdgUCWQ5+eE60rA18mfxmDCM0R/Slw/hw6fEOB+qdwpmTr8Ks7vTD4s4XIObHxbUlCEWXfWLwYjW1GwH2+PxN92mnhM5u9QSa04MMrPOF2UbG1FEnjeQv7kw/QLO+rQlxVnAKN9MKmh9WiiWtBDIUA/6tRauBERQ6ZV48YfCzxnzZ/v3Hsb28r7+NI8hqkZ649yqxDaKgIHvszuaeUWltAAjpn7gHmaCZyIiFXbuE/BqHGKy1G/E1P8SovA7vpdJZpf/LNCnVJ85eciwvoc5XArHHYg9Mc+kB+mE+h2iYFkT06pCZnpeo5Ii4u4SQv7DDf4z+pNw8bkA3EieTKbGvHo9z17YJVUzDROuhkogq2Gj9APMCR1p8BtB5VhP0Z1wTkVdZ9XfHDk5lfE9FLnjH7vyZPyy10bhpcpdZFDhAF9iXWu4EtvB7G5yrARAf1xC1B+xiAmlVUtkg3cBlt3QtGfRd0aNSq9NegYgKvNXx0p3w+rtR3POrY9uXiV+xZr2K1/7HXsqRyzPFEtyXHNMRezjYDITDWzyZM6P+6fIMDB0Z8pEzNqVo0MIJDvl9HIiJKn52lORs1mn9qPLqOSBP/Sxf1IUzIfj9cyVA1p79Ss0H0tleMqDECZcmOEkBqmkjcWwST5ZBYI9fmDSqHA0Is7fRH5N8oRgUjRizctiQw/FRaTYIjZCDhEED3wSFn/2UTNvVoVAlY5ocFdGRifri8vILt+ZUo9iOeWHl2HefNm7sSZRsngnUH47778H1RASNXv/QVS2z2MaQB+UWPtoSgH9xI4OotgPpUl2lULFuFxu1OrcZXKH/Y5rmsfuPVhKoD5h9Y3ULGfYSQ7aMB/My0u0Tn0Nie75arzW8DdLq5/RASB9rTsgj0UmPCVZaUgjSR9NAJrAw7WGhMpVpDmwGl/0yoHCzLdMsYgwFIdUSYKjL7u5WLh+4OfFZuNSv8yRRJcjLrBiBui6nTCQnp7Jzavfj3YKsUnNEA/ME7LlKj7uyV00680BAWj8Pn901WrcchEng5chY953mhMXd51hhDpsocRLqFzbzwf9Kc67v5OGlmWGsRFSa2ZObdWutOeOg2eR0pTv9lgxHwa5T9mQJu284Gq+8rF8tIEKjfuPjNJyar9PFgprj9yOQbSHJV2AC6OWjtO8ktatQG6qqUiXf5rAuVaW0KJSAhc32iS0QjDNTExWOPrH2C1t/Dr7ArcW3BFSNSOWfao7EGOFlRb3ZGF8xJ9czRgxiMp0AwOgCiIjnpqwCKCQ5vc0B8DZKAQJ674eo8XaFR4HbLK/4o84Y/VTEmiByuPw4jqFbrEKM1C/Eo7KFDdS9t7bmjTplUKXtgqQ9NRUvk6ApnAJ7q7713ukJMg+RLHeYslgaZDQlxWdfDEiJYz4wCIdEPkQ9efRNDHgVC9nNhyCuk+W3kz9egSRpGs1lxt32i6e0LzvrhR0PG9ZPGA/ukh3QLBofJL9/dz5r574L5PnXVjWc79Z3uBWh4fcvxMzZ9vmUtBMILXc02Ou500yE58lawhjyGG8hvARGIy9kejA58UNoxf1WCrLXuTZbLY6YgQ3EDJQZkxvAtS4oj6lARz3mAAA=',
    rarityIndex: {
      common: 0,
      uncommon: 1,
      rare: 2,
      ultra: 3,
      secret: 4,
    },
  },
}

const BOOSTER_TEMPLATES = [
  ['forge', 'Forge', '🔥', 18],
  ['titan', 'Titan', '🗿', 38],
  ['voltage', 'Voltage', '⚡', 58],
  ['lunar', 'Lunaire', '🌙', 258],
  ['solar', 'Solaire', '☀️', 42],
  ['dragon', 'Dragon', '🐉', 6],
  ['crown', 'Couronne', '♛', 46],
  ['abyss', 'Abysses', '◉', 222],
  ['sakura', 'Sakura', '✿', 332],
  ['atlas', 'Atlas', '▲', 154],
  ['mirage', 'Mirage', '◈', 282],
  ['nordic', 'Nordique', '❄', 198],
  ['arena', 'Arène', '⚔', 12],
  ['precision', 'Précision', '◎', 174],
  ['wild', 'Wild', '✹', 88],
  ['champion', 'Champion', '★', 48],
  ['eclipse', 'Éclipse', '◐', 266],
  ['neon', 'Néon', '✧', 304],
  ['storm', 'Storm', 'ϟ', 210],
  ['secret-lab', 'Secret Lab', '⌁', 126],
]

const DECK_SIZE = 12
const MAX_COPY_IN_DECK = 2
const START_HP = 24
const MAX_TURNS = 14

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function hashString(value) {
  let hash = 2166136261

  for (
    const char
    of String(value || '')
  ) {
    hash ^=
      char.charCodeAt(0)

    hash =
      Math.imul(
        hash,
        16777619
      )
  }

  return Math.abs(
    hash >>> 0
  )
}

function seededRatio(value) {
  return (
    hashString(value) %
    10000
  ) / 10000
}

function athleteSlug(athlete) {
  return String(
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    ''
  )
    .trim()
    .toLowerCase()
}

function imageSrc(athlete) {
  const raw =
    String(
      athlete?.profileImage ||
      ''
    ).trim()

  if (!raw) {
    return ''
  }

  if (
    raw.startsWith('data:') ||
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('/')
  ) {
    return raw
  }

  return '/' + raw
}

function cardId(
  slug,
  rarity
) {
  return (
    String(slug) +
    ':' +
    String(rarity)
  )
}

function parseCardId(id) {
  const [
    slug,
    rarity,
  ] =
    String(id || '')
      .split(':')

  return {
    slug,
    rarity,
  }
}

function rarityMeta(rarity) {
  return (
    RARITIES[rarity] ||
    RARITIES.common
  )
}

function archetypeFor(slug) {
  return ARCHETYPES[
    hashString(slug) %
    ARCHETYPES.length
  ]
}

function buildCard(
  athlete,
  rarity = 'common'
) {
  const slug =
    athleteSlug(athlete)

  const meta =
    rarityMeta(rarity)

  const archetype =
    archetypeFor(slug)

  const seed =
    hashString(
      slug +
      ':' +
      rarity
    )

  const cost =
    Math.max(
      1,
      Math.min(
        5,
        1 +
        Math.floor(
          (
            seed %
            5
          ) *
          .75
        ) +
        meta.costBias
      )
    )

  const usableBudget =
    meta.budget +
    Math.max(
      0,
      cost - 2
    )

  let attack =
    3 +
    (
      seed %
      Math.max(
        2,
        usableBudget - 4
      )
    )

  attack =
    Math.min(
      usableBudget - 2,
      attack
    )

  let guard =
    Math.max(
      2,
      usableBudget -
      attack
    )

  if (
    archetype.id ===
      'power'
  ) {
    attack += 1
    guard =
      Math.max(
        2,
        guard - 1
      )
  }

  if (
    archetype.id ===
      'guard'
  ) {
    guard += 1
    attack =
      Math.max(
        2,
        attack - 1
      )
  }

  return {
    id:
      cardId(
        slug,
        rarity
      ),
    slug,
    athlete,
    rarity,
    rarityMeta: meta,
    archetype,
    cost,
    attack,
    guard,
    score:
      attack +
      guard +
      meta.rank * 2 -
      cost * .6,
  }
}

function catalogForAthletes(
  athletes
) {
  const map =
    new Map()

  for (
    const athlete
    of athletes
  ) {
    const slug =
      athleteSlug(
        athlete
      )

    if (!slug) {
      continue
    }

    for (
      const rarity
      of Object.keys(
        RARITIES
      )
    ) {
      const card =
        buildCard(
          athlete,
          rarity
        )

      map.set(
        card.id,
        card
      )
    }
  }

  return map
}

function boosterCatalog(
  athletes
) {
  const clean =
    athletes.filter(
      athlete =>
        athleteSlug(
          athlete
        )
    )

  return BOOSTER_TEMPLATES
    .map(
      (
        [
          id,
          name,
          icon,
          hue,
        ],
        index
      ) => {
        const featured =
          clean.filter(
            (
              _,
              athleteIndex
            ) =>
              athleteIndex %
                BOOSTER_TEMPLATES.length ===
              index
          )

        const fallback =
          clean.filter(
            (
              _,
              athleteIndex
            ) =>
              athleteIndex %
                10 ===
              index %
                10
          )

        return {
          id,
          name,
          icon,
          hue,
          featured:
            featured.length
              ? featured
              : fallback,
        }
      }
    )
}

function randomItem(items) {
  if (!items.length) {
    return null
  }

  const bytes =
    new Uint32Array(1)

  crypto.getRandomValues(
    bytes
  )

  return items[
    bytes[0] %
    items.length
  ]
}

function randomPercent() {
  const bytes =
    new Uint32Array(1)

  crypto.getRandomValues(
    bytes
  )

  return (
    bytes[0] /
    4294967295
  ) * 100
}

function chooseRarity({
  premium = false,
  openingNumber = 1,
}) {
  if (
    premium &&
    openingNumber %
      50 ===
      0
  ) {
    return 'secret'
  }

  if (
    premium &&
    openingNumber %
      10 ===
      0
  ) {
    return 'ultra'
  }

  const roll =
    randomPercent()

  if (premium) {
    if (roll < 3) {
      return 'secret'
    }

    if (roll < 15) {
      return 'ultra'
    }

    if (roll < 50) {
      return 'rare'
    }

    return 'uncommon'
  }

  if (roll < .2) {
    return 'secret'
  }

  if (roll < 1.5) {
    return 'ultra'
  }

  if (roll < 9) {
    return 'rare'
  }

  if (roll < 36) {
    return 'uncommon'
  }

  return 'common'
}

function drawBooster({
  booster,
  athletes,
  openingNumber,
}) {
  const featured =
    booster?.featured ||
    []

  return Array.from(
    {
      length: 5,
    },
    (_, index) => {
      const rarity =
        chooseRarity({
          premium:
            index === 4,
          openingNumber,
        })

      const useFeatured =
        featured.length >
          0 &&
        randomPercent() <
          58

      const athlete =
        randomItem(
          useFeatured
            ? featured
            : athletes
        )

      return buildCard(
        athlete,
        rarity
      )
    }
  )
}

function ensureStyles() {
  if (
    document.getElementById(
      'ga-tcg-style-v1'
    )
  ) {
    return
  }

  const style =
    document.createElement(
      'style'
    )

  style.id =
    'ga-tcg-style-v1'

  style.textContent = `
    .tcg-app{--tcg-accent:#ffca5d;min-height:100vh;padding:14px;color:#f7f8ff;background:radial-gradient(circle at 50% -10%,rgba(86,67,166,.28),transparent 32%),linear-gradient(180deg,#080a14,#101326 54%,#070912);font-family:Inter,system-ui,sans-serif}
    .tcg-shell{width:min(1180px,100%);margin:0 auto}
    .tcg-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}.tcg-top h1{margin:0;font-size:24px}.tcg-top small{display:block;color:#8a91ac;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.tcg-spacer{flex:1}.tcg-back,.tcg-chip{border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.045);color:#f7f8ff;padding:9px 11px;font-weight:900}.tcg-back{cursor:pointer}.tcg-chip b{color:#ffd66d}
    .tcg-athlete-select{min-width:160px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#12162a;color:white;padding:9px 10px;font-weight:800}
    .tcg-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(250px,.85fr);gap:15px;padding:18px;border:1px solid rgba(255,214,109,.18);border-radius:22px;background:radial-gradient(circle at 80% 5%,rgba(255,214,109,.13),transparent 28%),linear-gradient(135deg,rgba(36,27,72,.95),rgba(11,15,31,.98));box-shadow:0 26px 80px rgba(0,0,0,.28)}
    .tcg-hero h2{margin:5px 0 7px;font-size:clamp(25px,5vw,46px);line-height:.98;letter-spacing:-.04em}.tcg-hero p{margin:0;max-width:650px;color:#939bb5;font-size:12px;line-height:1.55}.tcg-kicker{color:#ffd66d;font-size:9px;font-weight:1000;letter-spacing:.16em}
    .tcg-hero-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tcg-hero-stat{padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(5,7,16,.5)}.tcg-hero-stat span{display:block;color:#7e87a0;font-size:8px;font-weight:900;text-transform:uppercase}.tcg-hero-stat b{display:block;margin-top:4px;font-size:20px}.tcg-hero-stat em{color:#ffd66d;font-style:normal}
    .tcg-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:12px 0}.tcg-nav button{min-height:46px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:#101529;color:#78829d;font-weight:950;cursor:pointer}.tcg-nav button.active{border-color:rgba(255,214,109,.42);background:linear-gradient(135deg,rgba(118,83,21,.32),rgba(74,49,18,.17));color:#fff}.tcg-panel{border:1px solid rgba(255,255,255,.075);border-radius:20px;background:rgba(11,14,28,.92);overflow:hidden}
    .tcg-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.018)}.tcg-panel-head h3{margin:0;font-size:16px}.tcg-panel-head p{margin:3px 0 0;color:#77809a;font-size:9px}.tcg-panel-pad{padding:14px}
    .tcg-booster-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.tcg-booster{--h:48;position:relative;min-height:190px;overflow:hidden;padding:13px;border:1px solid hsla(var(--h),80%,65%,.26);border-radius:18px;background:radial-gradient(circle at 75% 20%,hsla(var(--h),80%,65%,.2),transparent 38%),linear-gradient(145deg,hsl(var(--h) 36% 18%),#0d1120 72%);color:white;text-align:left;cursor:pointer;transition:.16s transform,.16s border-color}.tcg-booster:hover{transform:translateY(-3px);border-color:hsla(var(--h),90%,70%,.55)}.tcg-booster-icon{font-size:34px}.tcg-booster strong{display:block;margin-top:28px;font-size:16px}.tcg-booster small{display:block;margin-top:4px;color:#a8afc1;font-size:9px;line-height:1.4}.tcg-booster span{display:inline-block;margin-top:9px;padding:4px 7px;border-radius:999px;background:hsla(var(--h),80%,60%,.15);color:hsl(var(--h) 90% 78%);font-size:8px;font-weight:950}
    .tcg-open-stage{display:grid;gap:14px;padding:18px}.tcg-pack-big{--h:48;width:min(260px,72vw);aspect-ratio:.72;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid hsla(var(--h),85%,70%,.38);border-radius:22px;background:radial-gradient(circle at 50% 28%,hsla(var(--h),90%,70%,.3),transparent 28%),linear-gradient(145deg,hsl(var(--h) 40% 20%),#090c17);box-shadow:0 28px 70px rgba(0,0,0,.42),inset 0 0 60px rgba(255,255,255,.035)}.tcg-pack-big i{font-style:normal;font-size:58px}.tcg-pack-big strong{margin-top:18px;font-size:24px}.tcg-pack-big small{margin-top:4px;color:#9ca5ba}.tcg-open-btn,.tcg-primary,.tcg-secondary{border:0;border-radius:13px;padding:12px 16px;font-weight:1000;cursor:pointer}.tcg-open-btn,.tcg-primary{background:linear-gradient(135deg,#f6c554,#e38b34);color:#1a1207}.tcg-open-btn:disabled,.tcg-primary:disabled{opacity:.35;cursor:not-allowed}.tcg-secondary{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#e8ebf5}
    .tcg-reveal-scene{--reveal:#9ca4b4;position:relative;overflow:hidden;padding:16px;border:1px solid color-mix(in srgb,var(--reveal),transparent 68%);border-radius:18px;background:radial-gradient(circle at 50% -10%,color-mix(in srgb,var(--reveal),transparent 77%),transparent 38%),linear-gradient(180deg,rgba(18,20,36,.96),rgba(7,9,17,.98));box-shadow:inset 0 0 55px color-mix(in srgb,var(--reveal),transparent 92%)}
    .tcg-reveal-scene[data-reveal-rarity="uncommon"]{--reveal:#5bd195}
    .tcg-reveal-scene[data-reveal-rarity="rare"]{--reveal:#6ea7ff}
    .tcg-reveal-scene[data-reveal-rarity="ultra"]{--reveal:#d46fff;box-shadow:0 0 34px rgba(212,111,255,.22),inset 0 0 65px rgba(212,111,255,.08)}
    .tcg-reveal-scene[data-reveal-rarity="secret"]{--reveal:#ffd45f;box-shadow:0 0 48px rgba(255,212,95,.3),0 0 85px rgba(179,83,255,.16),inset 0 0 75px rgba(255,212,95,.08)}
    .tcg-reveal-scene:before{content:"";position:absolute;inset:-70%;pointer-events:none;background:conic-gradient(from 20deg,transparent 0 38%,color-mix(in srgb,var(--reveal),transparent 78%) 44%,transparent 50% 100%);animation:tcgRevealAura 9s linear infinite}
    .tcg-reveal-announcement{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:13px;text-align:center}.tcg-reveal-announcement span{font-size:9px;font-weight:1000;letter-spacing:.18em;color:#8992aa}.tcg-reveal-announcement strong{font-size:13px;letter-spacing:.12em;color:var(--reveal);text-shadow:0 0 16px color-mix(in srgb,var(--reveal),transparent 28%)}
    .tcg-reveal{position:relative;z-index:2;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}
    .tcg-card.is-reveal[data-rarity="common"]{animation-duration:.4s}
    .tcg-card.is-reveal[data-rarity="uncommon"]{animation-name:tcgRevealUncommon;animation-duration:.52s}
    .tcg-card.is-reveal[data-rarity="rare"]{animation-name:tcgRevealRare;animation-duration:.62s}
    .tcg-card.is-reveal[data-rarity="ultra"]{animation-name:tcgRevealUltra;animation-duration:.78s}
    .tcg-card.is-reveal[data-rarity="secret"]{animation-name:tcgRevealSecret;animation-duration:1s}
    .tcg-card.is-reveal[data-rarity="rare"]:after,.tcg-card.is-reveal[data-rarity="ultra"]:after,.tcg-card.is-reveal[data-rarity="secret"]:after{content:"";position:absolute;inset:-55%;z-index:9;pointer-events:none;background:linear-gradient(110deg,transparent 39%,rgba(255,255,255,.0) 44%,rgba(255,255,255,.58) 49%,transparent 55%);transform:translateX(-65%) rotate(8deg);animation:tcgRevealShine 1.65s .35s ease-out both}
    .tcg-card.is-reveal[data-rarity="secret"]{box-shadow:0 0 0 1px rgba(255,232,133,.66),0 0 30px rgba(255,212,95,.38),0 0 55px rgba(180,75,255,.28),0 18px 44px rgba(0,0,0,.46)}
.tcg-card{--rarity:#8a94aa;position:relative;min-width:0;overflow:hidden;border:2px solid color-mix(in srgb,var(--rarity),transparent 18%);border-radius:16px;background:radial-gradient(circle at 50% 12%,color-mix(in srgb,var(--rarity),transparent 78%),transparent 34%),linear-gradient(180deg,#20263a,#0d1120 72%);box-shadow:0 15px 35px rgba(0,0,0,.28);color:#fff}.tcg-card[data-rarity="common"]{--rarity:#9ca4b4}.tcg-card[data-rarity="uncommon"]{--rarity:#5bd195}.tcg-card[data-rarity="rare"]{--rarity:#6ea7ff}.tcg-card[data-rarity="ultra"]{--rarity:#d46fff}.tcg-card[data-rarity="secret"]{--rarity:#ffd45f}.tcg-card.is-reveal{animation:tcgReveal .46s cubic-bezier(.2,.8,.2,1) both}.tcg-card:nth-child(2){animation-delay:.08s}.tcg-card:nth-child(3){animation-delay:.16s}.tcg-card:nth-child(4){animation-delay:.24s}.tcg-card:nth-child(5){animation-delay:.32s}
    .tcg-card-art{position:relative;aspect-ratio:1.08;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--rarity),#111 68%),#090b13)}.tcg-card-art img{width:100%;height:100%;object-fit:cover;object-position:center 22%;filter:saturate(.92) contrast(1.03)}.tcg-card-art .fallback{height:100%;display:grid;place-items:center;font-size:50px}.tcg-card-rarity{position:absolute;left:7px;top:7px;padding:4px 6px;border:1px solid color-mix(in srgb,var(--rarity),white 28%);border-radius:999px;background:rgba(7,9,16,.8);color:var(--rarity);font-size:7px;font-weight:1000}.tcg-card-cost{position:absolute;right:7px;top:7px;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--rarity);color:#0c0d13;font-size:12px;font-weight:1000}.tcg-card-body{padding:9px}.tcg-card-name{display:block;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.tcg-card-type{margin-top:2px;color:var(--rarity);font-size:7px;font-weight:950;text-transform:uppercase}.tcg-card-stats{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.tcg-card-stats span{padding:6px;border-radius:8px;background:rgba(255,255,255,.04);color:#8c96ad;font-size:7px}.tcg-card-stats b{display:block;margin-top:1px;color:#fff;font-size:13px}.tcg-card-skill{min-height:38px;margin-top:7px;color:#838ca3;font-size:7px;line-height:1.35}.tcg-card-copy{position:absolute;right:7px;bottom:7px;padding:3px 5px;border-radius:7px;background:rgba(0,0,0,.55);font-size:8px;font-weight:950}
    .tcg-card-evolution{position:absolute;left:7px;bottom:7px;max-width:70%;padding:4px 7px;border:1px solid color-mix(in srgb,var(--rarity),transparent 30%);border-radius:999px;background:rgba(7,8,18,.72);backdrop-filter:blur(6px);color:#fff;font-size:6.5px;font-weight:1000;letter-spacing:.05em;text-transform:uppercase;z-index:5}
    .tcg-card--illustrated{aspect-ratio:2/3;min-height:0;background:#070811}
    .tcg-card--illustrated .tcg-card-art{position:absolute;inset:0;aspect-ratio:auto;background:#080812}
    .tcg-illustration-sprite{position:absolute;inset:0;background-repeat:no-repeat;background-size:500% 100%;background-position-y:center}
    .tcg-card--illustrated .tcg-card-rarity,.tcg-card--illustrated .tcg-card-evolution{display:none}
    .tcg-card--illustrated .tcg-card-cost{top:40px;right:9px;z-index:8;width:25px;height:25px;border:1px solid rgba(255,255,255,.38);box-shadow:0 4px 14px rgba(0,0,0,.42)}
    .tcg-card--illustrated .tcg-card-body{position:absolute;left:7px;right:7px;bottom:7px;z-index:8;margin:0;padding:5px;border:1px solid color-mix(in srgb,var(--rarity),transparent 48%);border-radius:10px;background:rgba(7,8,18,.78);backdrop-filter:blur(8px)}
    .tcg-card--illustrated .tcg-card-name,.tcg-card--illustrated .tcg-card-type,.tcg-card--illustrated .tcg-card-skill{display:none}
    .tcg-card--illustrated .tcg-card-stats{grid-template-columns:1fr 1fr;gap:4px;margin:0}
    .tcg-card--illustrated .tcg-card-stats span{padding:4px 5px;border-radius:7px;background:rgba(255,255,255,.055);font-size:6px}
    .tcg-card--illustrated .tcg-card-stats b{font-size:11px}
    .tcg-card--illustrated .tcg-card-copy{z-index:10;right:9px;bottom:48px}
    .tcg-card--signature .tcg-card-art{isolation:isolate}.tcg-card--signature .tcg-card-art:after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;background:radial-gradient(circle at 52% 40%,transparent 22%,rgba(20,8,44,.15) 58%,rgba(4,3,13,.46) 100%);mix-blend-mode:screen}
    .tcg-card--signature[data-rarity="common"] .tcg-card-art img{filter:none}
    .tcg-card--signature[data-rarity="uncommon"] .tcg-card-art img{filter:saturate(1.04) contrast(1.04) drop-shadow(0 0 7px rgba(104,103,255,.32))}
    .tcg-card--signature[data-rarity="rare"] .tcg-card-art img{filter:saturate(1.12) contrast(1.07) drop-shadow(0 0 10px rgba(145,79,255,.45));transform:scale(1.03)}
    .tcg-card--signature[data-rarity="ultra"] .tcg-card-art img{filter:saturate(1.2) contrast(1.09) drop-shadow(0 0 14px rgba(177,77,255,.58));transform:scale(1.06)}
    .tcg-card--signature[data-rarity="secret"] .tcg-card-art img{filter:saturate(1.28) contrast(1.12) drop-shadow(0 0 18px rgba(255,215,94,.55));transform:scale(1.08)}
    .tcg-power-vfx{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3}.tcg-psi-ring{position:absolute;left:50%;top:44%;width:58%;aspect-ratio:1;border:1.5px solid rgba(154,116,255,.65);border-radius:50%;box-shadow:0 0 12px rgba(117,80,255,.45),inset 0 0 10px rgba(193,125,255,.25);transform:translate(-50%,-50%);animation:tcgPsiSpin 8s linear infinite}.tcg-psi-ring--b{width:78%;border-style:dashed;opacity:.62;animation-duration:13s;animation-direction:reverse}.tcg-psi-sigil{position:absolute;left:50%;top:16%;transform:translateX(-50%);color:rgba(215,192,255,.82);font-size:30px;text-shadow:0 0 12px #8f56ff,0 0 26px #4b33ff;animation:tcgPsiPulse 2.2s ease-in-out infinite}.tcg-psi-particle{position:absolute;color:#d9c4ff;text-shadow:0 0 8px #8d5bff;font-size:10px;animation:tcgPsiFloat 3.2s ease-in-out infinite}.tcg-psi-particle.p1{left:18%;top:28%}.tcg-psi-particle.p2{right:15%;top:36%;animation-delay:-.8s}.tcg-psi-particle.p3{left:29%;bottom:18%;animation-delay:-1.4s}.tcg-psi-particle.p4{right:28%;bottom:24%;animation-delay:-2s}
    .tcg-card[data-design="psychic-lifter"][data-rarity="rare"] .tcg-power-vfx:after,.tcg-card[data-design="psychic-lifter"][data-rarity="ultra"] .tcg-power-vfx:after,.tcg-card[data-design="psychic-lifter"][data-rarity="secret"] .tcg-power-vfx:after{content:"◉  ◌  ◉";position:absolute;left:50%;bottom:10%;transform:translateX(-50%) rotate(-7deg);color:rgba(220,206,255,.78);font-size:18px;letter-spacing:9px;text-shadow:0 0 10px #7f4cff;animation:tcgPsiLift 2.5s ease-in-out infinite}
    .tcg-card[data-design="psychic-savant"][data-rarity="rare"] .tcg-power-vfx:after,.tcg-card[data-design="psychic-savant"][data-rarity="ultra"] .tcg-power-vfx:after,.tcg-card[data-design="psychic-savant"][data-rarity="secret"] .tcg-power-vfx:after{content:"⌁  ◇  ⌁";position:absolute;left:50%;bottom:12%;transform:translateX(-50%);color:rgba(191,219,255,.85);font-size:16px;letter-spacing:7px;text-shadow:0 0 11px #605bff;animation:tcgPsiLift 2.2s ease-in-out infinite}
    .tcg-card--full-art{min-height:330px}.tcg-card--full-art .tcg-card-art{position:absolute;inset:0;aspect-ratio:auto}.tcg-card--full-art .tcg-card-art img{object-position:center 24%}.tcg-card--full-art .tcg-card-body{position:relative;z-index:6;margin-top:205px;padding:42px 10px 10px;background:linear-gradient(180deg,transparent,rgba(9,7,19,.88) 28%,rgba(8,9,18,.98) 66%)}.tcg-card--full-art .tcg-card-name{font-size:14px;text-shadow:0 2px 8px #000}.tcg-card--full-art .tcg-card-stats span{background:rgba(12,10,24,.62);backdrop-filter:blur(6px)}.tcg-card--full-art[data-rarity="secret"]{box-shadow:0 0 0 1px rgba(255,227,116,.5),0 0 28px rgba(177,72,255,.36),0 18px 44px rgba(0,0,0,.45)}
    .tcg-card--signature[data-rarity="ultra"]:before,.tcg-card--signature[data-rarity="secret"]:before{content:"";position:absolute;inset:-45%;z-index:7;pointer-events:none;background:linear-gradient(105deg,transparent 36%,rgba(255,255,255,.0) 43%,rgba(255,255,255,.3) 49%,rgba(188,126,255,.18) 53%,transparent 61%);transform:translateX(-55%) rotate(8deg);animation:tcgHoloSweep 4.2s ease-in-out infinite}
    @keyframes tcgPsiSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes tcgPsiPulse{50%{opacity:.55;transform:translateX(-50%) scale(1.12)}}@keyframes tcgPsiFloat{50%{transform:translateY(-9px) rotate(16deg);opacity:.5}}@keyframes tcgPsiLift{50%{transform:translateX(-50%) translateY(-9px) rotate(4deg)}}@keyframes tcgHoloSweep{0%,22%{transform:translateX(-70%) rotate(8deg)}55%,100%{transform:translateX(70%) rotate(8deg)}}
    .tcg-collection-toolbar{display:flex;gap:7px;flex-wrap:wrap}.tcg-collection-toolbar button{border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#11172a;color:#7e88a2;padding:7px 9px;font-size:9px;font-weight:900;cursor:pointer}.tcg-collection-toolbar button.active{border-color:#eab74d;color:#fff;background:#2c2416}.tcg-card-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.tcg-card-grid .tcg-card{cursor:pointer;transition:.14s transform,.14s filter}.tcg-card-grid .tcg-card:hover{transform:translateY(-3px);filter:brightness(1.06)}
    .tcg-deck-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:12px}.tcg-deck-list{display:grid;gap:7px}.tcg-deck-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:#101629}.tcg-deck-row .mini{width:38px;height:38px;display:grid;place-items:center;border-radius:9px;background:#181f35;font-weight:950}.tcg-deck-row strong{display:block;font-size:10px}.tcg-deck-row small{display:block;color:#76819a;font-size:8px}.tcg-deck-row button{border:0;border-radius:8px;background:#311b24;color:#ff9aab;padding:7px 8px;cursor:pointer}.tcg-deck-summary{padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:15px;background:#0d1222}.tcg-deck-summary h4{margin:0}.tcg-curve{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:11px}.tcg-curve div{text-align:center;padding:7px 3px;border-radius:8px;background:#141b2d}.tcg-curve b{display:block}.tcg-curve span{font-size:7px;color:#707b94}
    .tcg-duel{display:grid;gap:12px}.tcg-duel-board{position:relative;overflow:hidden;min-height:420px;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:radial-gradient(circle at 50% 50%,rgba(103,73,184,.17),transparent 36%),linear-gradient(180deg,#151a31,#090c17)}.tcg-hp-row{display:flex;justify-content:space-between;gap:12px}.tcg-hp{width:44%;padding:9px;border-radius:11px;background:rgba(0,0,0,.28)}.tcg-hp header{display:flex;justify-content:space-between;font-size:9px;font-weight:900}.tcg-hp-track{height:7px;margin-top:5px;border-radius:999px;background:#272d42;overflow:hidden}.tcg-hp-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#ff625f,#ffb157);transition:width .25s ease}.tcg-battle-center{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;min-height:250px}.tcg-battle-slot{min-width:0}.tcg-battle-slot .tcg-card{width:min(190px,100%);margin:auto}.tcg-versus{font-size:18px;font-weight:1000;color:#6f7891}.tcg-battle-log{min-height:36px;padding:9px 11px;border-radius:11px;background:rgba(0,0,0,.25);color:#9da6ba;font-size:9px;text-align:center}.tcg-hand{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.tcg-hand .tcg-card{cursor:pointer;transition:.14s transform,.14s opacity}.tcg-hand .tcg-card:hover{transform:translateY(-4px)}.tcg-hand .tcg-card.is-locked{opacity:.34;cursor:not-allowed;filter:grayscale(.6)}.tcg-energy{text-align:center;color:#ffd66d;font-size:10px;font-weight:950}.tcg-duel-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
    .tcg-empty{padding:28px;text-align:center;color:#77829b}.tcg-empty b{display:block;color:#dce1ee;margin-bottom:5px}.tcg-error{margin:10px 0;padding:9px 11px;border:1px solid rgba(255,87,102,.24);border-radius:10px;background:rgba(111,28,37,.18);color:#ff9fac;font-size:9px}
    @keyframes tcgReveal{from{opacity:0;transform:translateY(22px) rotateY(80deg) scale(.9)}to{opacity:1;transform:none}}
    @keyframes tcgRevealAura{to{transform:rotate(360deg)}}
    @keyframes tcgRevealShine{0%{transform:translateX(-75%) rotate(8deg);opacity:0}20%{opacity:1}100%{transform:translateX(75%) rotate(8deg);opacity:0}}
    @keyframes tcgRevealUncommon{0%{opacity:0;transform:translateY(26px) scale(.88)}65%{transform:translateY(-4px) scale(1.025)}100%{opacity:1;transform:none}}
    @keyframes tcgRevealRare{0%{opacity:0;filter:brightness(2);transform:translateY(30px) scale(.82) rotateY(72deg)}58%{filter:brightness(1.35);transform:translateY(-6px) scale(1.045)}100%{opacity:1;filter:none;transform:none}}
    @keyframes tcgRevealUltra{0%{opacity:0;filter:brightness(3) saturate(1.8);transform:scale(.68) rotateY(100deg)}48%{opacity:1;filter:brightness(1.65) saturate(1.35);transform:scale(1.09) rotateY(-7deg)}72%{transform:scale(.98) rotateY(3deg)}100%{filter:none;transform:none}}
    @keyframes tcgRevealSecret{0%{opacity:0;filter:brightness(4) saturate(2);transform:scale(.55) rotateY(120deg)}35%{opacity:1;filter:brightness(2.2) saturate(1.7);transform:scale(1.13) rotateY(-9deg)}58%{transform:scale(.97) rotateY(4deg)}78%{transform:scale(1.025)}100%{filter:none;transform:none}}
    @media(max-width:900px){.tcg-booster-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.tcg-card-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.tcg-reveal{grid-template-columns:repeat(3,minmax(0,1fr))}.tcg-reveal .tcg-card:nth-child(4),.tcg-reveal .tcg-card:nth-child(5){grid-column:auto}.tcg-deck-layout{grid-template-columns:1fr}}
    @media(max-width:650px){.tcg-app{padding:8px}.tcg-top{flex-wrap:wrap}.tcg-top h1{font-size:19px}.tcg-athlete-select{order:5;width:100%}.tcg-hero{grid-template-columns:1fr;padding:13px}.tcg-hero h2{font-size:30px}.tcg-nav{grid-template-columns:repeat(2,1fr)}.tcg-booster-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tcg-booster{min-height:160px}.tcg-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tcg-reveal{grid-template-columns:repeat(2,minmax(0,1fr))}.tcg-reveal .tcg-card:last-child{grid-column:1/-1;width:50%;justify-self:center}.tcg-hand{grid-template-columns:repeat(2,minmax(0,1fr))}.tcg-battle-center{grid-template-columns:1fr 28px 1fr;gap:5px}.tcg-card-skill{display:none}.tcg-hp{width:48%}}
  `

  document.head.appendChild(
    style
  )
}

function dedicatedCardArt(
  card
) {
  const art =
    CHARACTER_CARD_ART[
      card?.slug
    ]

  if (!art) {
    return null
  }

  const index =
    art.rarityIndex?.[
      card?.rarity
    ]

  if (
    !Number.isInteger(
      index
    )
  ) {
    return null
  }

  return {
    sprite: art.sprite,
    index,
    position:
      index * 25,
  }
}

function highestRarity(
  cards
) {
  return (
    cards
      .slice()
      .sort(
        (a, b) =>
          b.rarityMeta.rank -
          a.rarityMeta.rank
      )[0]?.rarity ||
    'common'
  )
}

function renderCard(
  card,
  {
    copies = null,
    reveal = false,
    action = '',
    locked = false,
  } = {}
) {
  const dedicatedArt =
    dedicatedCardArt(
      card
    )

  const image =
    dedicatedArt
      ? ''
      : imageSrc(
          card.athlete
        )

  const design =
    CHARACTER_DESIGNS[
      card.slug
    ] ||
    null

  const stageLabel =
    design?.stages?.[
      card.rarity
    ] ||
    ''

  const signatureClass =
    design
      ? 'tcg-card--signature'
      : ''

  const fullArtClass =
    dedicatedArt ||
    (
      design &&
      (
        card.rarity === 'ultra' ||
        card.rarity === 'secret'
      )
    )
      ? 'tcg-card--full-art'
      : ''

  const illustratedClass =
    dedicatedArt
      ? 'tcg-card--illustrated'
      : ''

  return `
    <article
      class="tcg-card ${signatureClass} ${fullArtClass} ${illustratedClass} ${reveal ? 'is-reveal' : ''} ${locked ? 'is-locked' : ''}"
      data-rarity="${esc(card.rarity)}"
      data-character="${esc(card.slug)}"
      data-design="${esc(design?.family || '')}"
      ${action ? `data-action="${esc(action)}" data-card-id="${esc(card.id)}"` : ''}
    >
      <div class="tcg-card-art">
        ${dedicatedArt
          ? `
            <div
              class="tcg-illustration-sprite"
              aria-hidden="true"
              style="background-image:url('${esc(dedicatedArt.sprite)}');background-position:${dedicatedArt.position}% center"
            ></div>
          `
          : image
            ? `
              <img
                src="${esc(image)}"
                alt=""
              >
            `
            : `
              <div class="fallback">
                ${esc(card.athlete?.emoji || '🏋️')}
              </div>
            `
        }

        ${design && card.rarity !== 'common' && !dedicatedArt
          ? `
            <div class="tcg-power-vfx" aria-hidden="true">
              <i class="tcg-psi-ring tcg-psi-ring--a"></i>
              <i class="tcg-psi-ring tcg-psi-ring--b"></i>
              <b class="tcg-psi-sigil">
                ${esc(design.sigil)}
              </b>
              <span class="tcg-psi-particle p1">✦</span>
              <span class="tcg-psi-particle p2">◈</span>
              <span class="tcg-psi-particle p3">✧</span>
              <span class="tcg-psi-particle p4">●</span>
            </div>
          `
          : ''
        }

        <span class="tcg-card-rarity">
          ${esc(card.rarityMeta.label)}
        </span>

        ${stageLabel
          ? `
            <span class="tcg-card-evolution">
              ${esc(stageLabel)}
            </span>
          `
          : ''
        }

        <span class="tcg-card-cost">
          ${card.cost}
        </span>
      </div>

      <div class="tcg-card-body">
        <strong class="tcg-card-name">
          ${esc(card.athlete?.name || card.slug)}
        </strong>

        <div class="tcg-card-type">
          ${esc(card.archetype.icon)}
          ${esc(card.archetype.label)}
        </div>

        <div class="tcg-card-stats">
          <span>
            ATK
            <b>${card.attack}</b>
          </span>

          <span>
            DEF
            <b>${card.guard}</b>
          </span>
        </div>

        <div class="tcg-card-skill">
          ${esc(card.archetype.text)}
        </div>
      </div>

      ${copies !== null
        ? `
          <span class="tcg-card-copy">
            ×${Number(copies) || 0}
          </span>
        `
        : ''
      }
    </article>
  `
}

function shuffled(items) {
  const result =
    items.slice()

  for (
    let index =
      result.length - 1;
    index > 0;
    index -= 1
  ) {
    const j =
      Math.floor(
        randomPercent() /
          100 *
          (
            index + 1
          )
      )

    ;[
      result[index],
      result[j],
    ] = [
      result[j],
      result[index],
    ]
  }

  return result
}

function appliedStats(
  card,
  opponent
) {
  let attack =
    card.attack
  let guard =
    card.guard

  switch (
    card.archetype.id
  ) {
    case 'power':
      if (
        card.cost >=
        opponent.cost
      ) {
        attack += 2
      }
      break

    case 'guard':
      guard += 2
      break

    case 'tempo':
      if (
        card.cost <= 2
      ) {
        attack += 1
        guard += 1
      }
      break

    case 'technique':
      if (
        opponent.attack >
        opponent.guard
      ) {
        attack += 1
        guard += 1
      }
      break

    case 'chaos':
      attack +=
        Math.floor(
          randomPercent() /
            25
        ) - 1
      break
  }

  return {
    attack:
      Math.max(
        0,
        attack
      ),
    guard:
      Math.max(
        0,
        guard
      ),
  }
}

function autoDeck(
  collection,
  catalog
) {
  const pool = []

  for (
    const row
    of collection
  ) {
    const card =
      catalog.get(
        row.card_id
      )

    if (!card) {
      continue
    }

    const count =
      Math.min(
        MAX_COPY_IN_DECK,
        Number(
          row.copies
        ) || 0
      )

    for (
      let i = 0;
      i < count;
      i += 1
    ) {
      pool.push(
        card
      )
    }
  }

  pool.sort(
    (a, b) =>
      b.score -
      a.score
  )

  const chosen = []
  const costCount =
    new Map()

  for (
    const card
    of pool
  ) {
    if (
      chosen.length >=
      DECK_SIZE
    ) {
      break
    }

    const sameCost =
      costCount.get(
        card.cost
      ) || 0

    if (
      card.cost >= 4 &&
      sameCost >= 4
    ) {
      continue
    }

    chosen.push(
      card.id
    )

    costCount.set(
      card.cost,
      sameCost + 1
    )
  }

  if (
    chosen.length <
      DECK_SIZE
  ) {
    for (
      const card
      of pool
    ) {
      if (
        chosen.length >=
        DECK_SIZE
      ) {
        break
      }

      const inDeck =
        chosen.filter(
          id =>
            id ===
            card.id
        ).length

      if (
        inDeck <
          MAX_COPY_IN_DECK
      ) {
        chosen.push(
          card.id
        )
      }
    }
  }

  return chosen
}

function buildAiDeck(
  athletes,
  playerCards
) {
  const avgRank =
    playerCards.length
      ? playerCards.reduce(
          (
            sum,
            card
          ) =>
            sum +
            card.rarityMeta.rank,
          0
        ) /
        playerCards.length
      : 1.6

  const rarityPool =
    avgRank >= 3.5
      ? [
          'uncommon',
          'rare',
          'rare',
          'ultra',
        ]
      : avgRank >= 2.4
        ? [
            'common',
            'uncommon',
            'uncommon',
            'rare',
          ]
        : [
            'common',
            'common',
            'uncommon',
            'rare',
          ]

  return Array.from(
    {
      length: DECK_SIZE,
    },
    () =>
      buildCard(
        randomItem(
          athletes
        ),
        randomItem(
          rarityPool
        )
      )
  )
}

export async function mountTcgGame(
  root,
  options = {}
) {
  ensureStyles()

  const athletes =
    Array.isArray(
      options.athletes
    )
      ? options.athletes
      : []

  const catalog =
    catalogForAthletes(
      athletes
    )

  const boosters =
    boosterCatalog(
      athletes
    )

  let activeSlug =
    String(
      options.initialSlug ||
      options.preferredSlug ||
      athleteSlug(
        athletes[0]
      ) ||
      ''
    ).toLowerCase()

  let tab = 'boosters'
  let selectedBooster =
    boosters[0] || null
  let profile = {
    unopened_packs: 0,
    opened_packs: 0,
    dust: 0,
  }
  let collection = []
  let deck = []
  let loading = true
  let error = ''
  let lastOpened = []
  let rarityFilter = 'all'
  let battle = null

  function currentAthlete() {
    return (
      athletes.find(
        athlete =>
          athleteSlug(
            athlete
          ) ===
          activeSlug
      ) ||
      athletes[0] ||
      null
    )
  }

  function ownedRows() {
    return collection
      .map(
        row => ({
          ...row,
          card:
            catalog.get(
              row.card_id
            ),
        })
      )
      .filter(
        row =>
          row.card
      )
  }

  function uniqueOwned() {
    return ownedRows()
      .length
  }

  function totalCopies() {
    return ownedRows()
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          (
            Number(
              row.copies
            ) || 0
          ),
        0
      )
  }

  function deckCards() {
    return deck
      .map(
        id =>
          catalog.get(id)
      )
      .filter(Boolean)
  }

  async function loadState() {
    if (!activeSlug) {
      loading = false
      render()
      return
    }

    loading = true
    error = ''
    battle = null
    lastOpened = []
    render()

    try {
      const [
        profileResult,
        collectionResult,
        deckResult,
      ] =
        await Promise.all([
          supabase.rpc(
            'ensure_tcg_profile_v1',
            {
              p_athlete_slug:
                activeSlug,
            }
          ),
          supabase
            .from(
              'tcg_collection'
            )
            .select(
              'card_id,copies,first_pulled_at,last_pulled_at'
            )
            .eq(
              'athlete_slug',
              activeSlug
            ),
          supabase
            .from(
              'tcg_decks'
            )
            .select(
              'deck'
            )
            .eq(
              'athlete_slug',
              activeSlug
            )
            .maybeSingle(),
        ])

      if (
        profileResult.error
      ) {
        throw profileResult.error
      }

      if (
        collectionResult.error
      ) {
        throw collectionResult.error
      }

      if (
        deckResult.error
      ) {
        throw deckResult.error
      }

      const row =
        Array.isArray(
          profileResult.data
        )
          ? profileResult.data[0]
          : profileResult.data

      profile = {
        unopened_packs:
          Number(
            row?.unopened_packs ||
            0
          ),
        opened_packs:
          Number(
            row?.opened_packs ||
            0
          ),
        dust:
          Number(
            row?.dust ||
            0
          ),
      }

      collection =
        collectionResult.data ||
        []

      deck =
        Array.isArray(
          deckResult.data?.deck
        )
          ? deckResult.data.deck
          : []

      if (
        deck.length !==
          DECK_SIZE &&
        collection.length
      ) {
        deck =
          autoDeck(
            collection,
            catalog
          )
      }
    } catch (loadError) {
      console.error(
        'TCG LOAD ERROR',
        loadError
      )

      error =
        loadError?.message ||
        'Impossible de charger le TCG.'
    } finally {
      loading = false
      render()
    }
  }

  async function refreshProfileAndCollection() {
    const [
      p,
      c,
    ] =
      await Promise.all([
        supabase
          .from(
            'tcg_profiles'
          )
          .select(
            'unopened_packs,opened_packs,dust'
          )
          .eq(
            'athlete_slug',
            activeSlug
          )
          .single(),
        supabase
          .from(
            'tcg_collection'
          )
          .select(
            'card_id,copies,first_pulled_at,last_pulled_at'
          )
          .eq(
            'athlete_slug',
            activeSlug
          ),
      ])

    if (p.error) {
      throw p.error
    }

    if (c.error) {
      throw c.error
    }

    profile =
      p.data

    collection =
      c.data ||
      []
  }

  async function openPack() {
    if (
      !selectedBooster ||
      Number(
        profile.unopened_packs
      ) <= 0
    ) {
      return
    }

    error = ''

    const nextOpening =
      Number(
        profile.opened_packs ||
        0
      ) + 1

    const cards =
      drawBooster({
        booster:
          selectedBooster,
        athletes,
        openingNumber:
          nextOpening,
      })

    const {
      data,
      error:
        openError,
    } =
      await supabase.rpc(
        'open_tcg_pack_v1',
        {
          p_athlete_slug:
            activeSlug,
          p_booster_id:
            selectedBooster.id,
          p_cards:
            cards.map(
              card => ({
                card_id:
                  card.id,
                rarity:
                  card.rarity,
              })
            ),
        }
      )

    if (openError) {
      error =
        openError.message
      render()
      return
    }

    lastOpened =
      cards

    const result =
      Array.isArray(data)
        ? data[0]
        : data

    profile.unopened_packs =
      Number(
        result?.remaining_packs ??
        Math.max(
          0,
          Number(
            profile.unopened_packs
          ) - 1
        )
      )

    profile.opened_packs =
      nextOpening

    await refreshProfileAndCollection()
    render()
  }

  async function saveDeck() {
    error = ''

    if (
      deck.length !==
        DECK_SIZE
    ) {
      error =
        `Le deck doit contenir exactement ${DECK_SIZE} cartes.`
      render()
      return
    }

    const {
      error:
        saveError,
    } =
      await supabase
        .from(
          'tcg_decks'
        )
        .upsert(
          {
            athlete_slug:
              activeSlug,
            deck,
            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              'athlete_slug',
          }
        )

    if (saveError) {
      error =
        saveError.message
    }

    render()
  }

  function copiesInDeck(
    cardIdValue
  ) {
    return deck.filter(
      id =>
        id ===
        cardIdValue
    ).length
  }

  function ownedCopies(
    cardIdValue
  ) {
    return Number(
      collection.find(
        row =>
          row.card_id ===
          cardIdValue
      )?.copies ||
      0
    )
  }

  function addToDeck(
    cardIdValue
  ) {
    if (
      deck.length >=
        DECK_SIZE
    ) {
      return
    }

    const already =
      copiesInDeck(
        cardIdValue
      )

    const owned =
      ownedCopies(
        cardIdValue
      )

    if (
      already >=
        MAX_COPY_IN_DECK ||
      already >= owned
    ) {
      return
    }

    deck = [
      ...deck,
      cardIdValue,
    ]

    render()
  }

  function removeFromDeck(
    cardIdValue
  ) {
    const index =
      deck.lastIndexOf(
        cardIdValue
      )

    if (index < 0) {
      return
    }

    deck = [
      ...deck.slice(
        0,
        index
      ),
      ...deck.slice(
        index + 1
      ),
    ]

    render()
  }

  function beginBattle() {
    let ids =
      deck.slice()

    if (
      ids.length !==
        DECK_SIZE
    ) {
      ids =
        autoDeck(
          collection,
          catalog
        )
    }

    if (
      ids.length <
        DECK_SIZE
    ) {
      error =
        'Il faut au moins 12 cartes disponibles pour lancer un duel.'
      render()
      return
    }

    const playerDeck =
      shuffled(
        ids
          .map(
            id =>
              catalog.get(id)
          )
          .filter(Boolean)
      )

    const aiDeck =
      shuffled(
        buildAiDeck(
          athletes,
          playerDeck
        )
      )

    const dealOpeningHand =
      deckCardsValue => {
        const hand =
          deckCardsValue.splice(
            0,
            4
          )

        if (
          !hand.some(
            card =>
              card.cost <= 2
          )
        ) {
          const playableIndex =
            deckCardsValue
              .findIndex(
                card =>
                  card.cost <= 2
              )

          if (
            playableIndex >= 0 &&
            hand.length
          ) {
            const playable =
              deckCardsValue[
                playableIndex
              ]

            deckCardsValue[
              playableIndex
            ] = hand[0]

            hand[0] =
              playable
          }
        }

        return hand
      }

    battle = {
      playerHp:
        START_HP,
      aiHp:
        START_HP,
      turn: 1,
      energy: 2,
      playerDeck,
      aiDeck,
      playerHand:
        dealOpeningHand(
          playerDeck
        ),
      aiHand:
        dealOpeningHand(
          aiDeck
        ),
      playerCard: null,
      aiCard: null,
      log:
        'Choisis une carte pour le premier duel.',
      finished: false,
      result: '',
    }

    error = ''
    render()
  }

  async function persistBattle(
    result
  ) {
    try {
      await supabase
        .from(
          'tcg_battles'
        )
        .insert({
          athlete_slug:
            activeSlug,
          result,
          opponent:
            'GA Rival AI',
          turns:
            battle?.turn ||
            0,
          player_hp:
            battle?.playerHp ||
            0,
          opponent_hp:
            battle?.aiHp ||
            0,
        })
    } catch (battleError) {
      console.error(
        'TCG BATTLE SAVE ERROR',
        battleError
      )
    }
  }

  function finishBattle() {
    if (!battle) {
      return
    }

    let result = 'draw'

    if (
      battle.playerHp >
      battle.aiHp
    ) {
      result = 'win'
    } else if (
      battle.aiHp >
      battle.playerHp
    ) {
      result = 'loss'
    }

    battle.finished = true
    battle.result = result
    battle.log =
      result === 'win'
        ? 'VICTOIRE · ton deck prend le dessus.'
        : result === 'loss'
          ? 'DÉFAITE · ajuste ta courbe de coût et tes matchups.'
          : 'ÉGALITÉ · duel parfaitement serré.'

    void persistBattle(
      result
    )
  }

  function playBattleCard(
    cardIdValue
  ) {
    if (
      !battle ||
      battle.finished
    ) {
      return
    }

    const playerIndex =
      battle.playerHand
        .findIndex(
          card =>
            card.id ===
            cardIdValue
        )

    const playerCard =
      battle.playerHand[
        playerIndex
      ]

    if (
      !playerCard ||
      playerCard.cost >
        battle.energy
    ) {
      return
    }

    const affordableAi =
      battle.aiHand
        .filter(
          card =>
            card.cost <=
            battle.energy
        )
        .sort(
          (a, b) =>
            (
              b.attack +
              b.guard * .8
            ) -
            (
              a.attack +
              a.guard * .8
            )
        )

    const aiCard =
      affordableAi[0] ||
      null

    const aiIndex =
      aiCard
        ? battle.aiHand
            .findIndex(
              card =>
                card === aiCard
            )
        : -1

    const emptyOpponent = {
      cost: 0,
      attack: 0,
      guard: 0,
    }

    const playerStats =
      appliedStats(
        playerCard,
        aiCard ||
          emptyOpponent
      )

    const aiStats =
      aiCard
        ? appliedStats(
            aiCard,
            playerCard
          )
        : {
            attack: 0,
            guard: 0,
          }

    let damageToAi =
      aiCard
        ? Math.max(
            0,
            playerStats.attack -
            aiStats.guard
          )
        : playerStats.attack

    let damageToPlayer =
      aiCard
        ? Math.max(
            0,
            aiStats.attack -
            playerStats.guard
          )
        : 0

    if (
      damageToAi === 0 &&
      damageToPlayer === 0
    ) {
      if (
        playerStats.attack >
        aiStats.attack
      ) {
        damageToAi = 1
      } else if (
        aiStats.attack >
        playerStats.attack
      ) {
        damageToPlayer = 1
      }
    }

    battle.playerHp =
      Math.max(
        0,
        battle.playerHp -
        damageToPlayer
      )

    battle.aiHp =
      Math.max(
        0,
        battle.aiHp -
        damageToAi
      )

    battle.playerCard =
      playerCard

    battle.aiCard =
      aiCard

    battle.playerHand.splice(
      playerIndex,
      1
    )

    if (
      aiIndex >= 0
    ) {
      battle.aiHand.splice(
        aiIndex,
        1
      )
    }

    battle.log =
      aiCard
        ? `${playerCard.athlete.name} inflige ${damageToAi} · ${aiCard.athlete.name} inflige ${damageToPlayer}.`
        : `GA Rival passe · ${playerCard.athlete.name} frappe directement pour ${damageToAi}.`

    if (
      battle.playerHp <= 0 ||
      battle.aiHp <= 0
    ) {
      finishBattle()
      render()
      return
    }

    if (
      battle.turn >=
        MAX_TURNS ||
      (
        !battle.playerDeck.length &&
        !battle.playerHand.length
      )
    ) {
      finishBattle()
      render()
      return
    }

    battle.turn += 1
    battle.energy =
      Math.min(
        5,
        battle.turn + 1
      )

    if (
      battle.playerDeck.length
    ) {
      battle.playerHand.push(
        battle.playerDeck.shift()
      )
    }

    if (
      battle.aiDeck.length
    ) {
      battle.aiHand.push(
        battle.aiDeck.shift()
      )
    }

    render()
  }

  function renderBoosters() {
    if (lastOpened.length) {
      const revealRarity =
        highestRarity(
          lastOpened
        )

      return `
        <section class="tcg-panel">
          <header class="tcg-panel-head">
            <div>
              <h3>
                Booster ouvert · ${esc(selectedBooster?.name || '')}
              </h3>
              <p>
                5 cartes ajoutées à ta collection.
              </p>
            </div>

            <button
              class="tcg-secondary"
              data-action="tcg-close-reveal"
              type="button"
            >
              Fermer
            </button>
          </header>

          <div class="tcg-panel-pad">
            <div
              class="tcg-reveal-scene"
              data-reveal-rarity="${esc(revealRarity)}"
            >
              <div class="tcg-reveal-announcement">
                <span>MEILLEURE PIOCHE</span>
                <strong>
                  ${esc(rarityMeta(revealRarity).label)}
                </strong>
              </div>

              <div class="tcg-reveal">
              ${lastOpened
                .map(
                  card =>
                    renderCard(
                      card,
                      {
                        reveal: true,
                      }
                    )
                )
                .join('')}
              </div>
            </div>
          </div>
        </section>
      `
    }

    return `
      <section class="tcg-panel">
        <header class="tcg-panel-head">
          <div>
            <h3>
              20 boosters GA
            </h3>
            <p>
              Même taux de rareté · pool vedette différent pour chaque série.
            </p>
          </div>

          <strong>
            🎴 ${Number(profile.unopened_packs) || 0}
          </strong>
        </header>

        <div class="tcg-panel-pad">
          <div class="tcg-booster-grid">
            ${boosters
              .map(
                booster => `
                  <button
                    class="tcg-booster"
                    style="--h:${booster.hue}"
                    data-action="tcg-select-booster"
                    data-booster-id="${esc(booster.id)}"
                    type="button"
                  >
                    <span class="tcg-booster-icon">
                      ${esc(booster.icon)}
                    </span>

                    <strong>
                      ${esc(booster.name)}
                    </strong>

                    <small>
                      ${booster.featured
                        .slice(0, 3)
                        .map(
                          athlete =>
                            esc(
                              athlete.name
                            )
                        )
                        .join(' · ') ||
                        'Pool mixte'
                      }
                    </small>

                    <span>
                      OUVRIR
                    </span>
                  </button>
                `
              )
              .join('')}
          </div>
        </div>
      </section>

      ${selectedBooster
        ? `
          <section class="tcg-panel" style="margin-top:12px">
            <div class="tcg-open-stage">
              <div
                class="tcg-pack-big"
                style="--h:${selectedBooster.hue}"
              >
                <i>
                  ${esc(selectedBooster.icon)}
                </i>

                <strong>
                  ${esc(selectedBooster.name)}
                </strong>

                <small>
                  5 cartes · slot final premium
                </small>
              </div>

              <button
                class="tcg-open-btn"
                data-action="tcg-open-pack"
                type="button"
                ${Number(profile.unopened_packs) > 0 ? '' : 'disabled'}
              >
                ${Number(profile.unopened_packs) > 0
                  ? 'OUVRIR LE BOOSTER'
                  : 'TERMINE UNE SÉANCE POUR GAGNER UN BOOSTER'
                }
              </button>

              <p style="margin:0;text-align:center;color:#737d96;font-size:9px">
                Pity : Ultra Rare garantie tous les 10 boosters · Secret Rare au 50e.
              </p>
            </div>
          </section>
        `
        : ''
      }
    `
  }

  function renderCollection() {
    const rows =
      ownedRows()
        .filter(
          row =>
            rarityFilter ===
              'all' ||
            row.card.rarity ===
              rarityFilter
        )
        .sort(
          (a, b) =>
            b.card.rarityMeta.rank -
              a.card.rarityMeta.rank ||
            a.card.athlete.name.localeCompare(
              b.card.athlete.name,
              'fr'
            )
        )

    return `
      <section class="tcg-panel">
        <header class="tcg-panel-head">
          <div>
            <h3>
              Collection
            </h3>
            <p>
              Chaque athlète existe en 5 raretés avec un coût et des stats équilibrés.
            </p>
          </div>

          <strong>
            ${uniqueOwned()} / ${catalog.size}
          </strong>
        </header>

        <div class="tcg-panel-pad">
          <div class="tcg-collection-toolbar">
            ${[
              ['all', 'Toutes'],
              ['common', 'Communes'],
              ['uncommon', 'Peu communes'],
              ['rare', 'Rares'],
              ['ultra', 'Ultra'],
              ['secret', 'Secret'],
            ]
              .map(
                ([id, label]) => `
                  <button
                    class="${rarityFilter === id ? 'active' : ''}"
                    data-action="tcg-rarity-filter"
                    data-rarity="${id}"
                    type="button"
                  >
                    ${label}
                  </button>
                `
              )
              .join('')}
          </div>

          <div
            class="tcg-card-grid"
            style="margin-top:12px"
          >
            ${rows.length
              ? rows
                  .map(
                    row =>
                      renderCard(
                        row.card,
                        {
                          copies:
                            row.copies,
                          action:
                            'tcg-add-card',
                        }
                      )
                  )
                  .join('')
              : `
                <div class="tcg-empty" style="grid-column:1/-1">
                  <b>Aucune carte ici.</b>
                  Ouvre des boosters pour compléter ta collection.
                </div>
              `
            }
          </div>
        </div>
      </section>
    `
  }

  function renderDeck() {
    const cards =
      deckCards()

    const curve =
      Array.from(
        {
          length: 5,
        },
        (_, index) =>
          cards.filter(
            card =>
              card.cost ===
              index + 1
          ).length
      )

    return `
      <section class="tcg-panel">
        <header class="tcg-panel-head">
          <div>
            <h3>
              Deck · ${deck.length}/${DECK_SIZE}
            </h3>
            <p>
              Maximum ${MAX_COPY_IN_DECK} copies d’une même carte.
            </p>
          </div>

          <div>
            <button
              class="tcg-secondary"
              data-action="tcg-auto-deck"
              type="button"
            >
              Auto
            </button>

            <button
              class="tcg-primary"
              data-action="tcg-save-deck"
              type="button"
              ${deck.length === DECK_SIZE ? '' : 'disabled'}
            >
              Sauver
            </button>
          </div>
        </header>

        <div class="tcg-panel-pad tcg-deck-layout">
          <div class="tcg-deck-list">
            ${cards.length
              ? cards
                  .map(
                    card => `
                      <article class="tcg-deck-row">
                        <div class="mini">
                          ${esc(card.rarityMeta.short)}
                        </div>

                        <div>
                          <strong>
                            ${esc(card.athlete.name)}
                          </strong>

                          <small>
                            ${esc(card.archetype.label)}
                            · coût ${card.cost}
                            · ${card.attack}/${card.guard}
                          </small>
                        </div>

                        <button
                          data-action="tcg-remove-card"
                          data-card-id="${esc(card.id)}"
                          type="button"
                        >
                          −
                        </button>
                      </article>
                    `
                  )
                  .join('')
              : `
                <div class="tcg-empty">
                  <b>Deck vide.</b>
                  Clique sur des cartes dans Collection ou utilise Auto.
                </div>
              `
            }
          </div>

          <aside class="tcg-deck-summary">
            <h4>
              Courbe d’énergie
            </h4>

            <div class="tcg-curve">
              ${curve
                .map(
                  (
                    value,
                    index
                  ) => `
                    <div>
                      <b>${value}</b>
                      <span>
                        coût ${index + 1}
                      </span>
                    </div>
                  `
                )
                .join('')}
            </div>

            <p style="color:#79849c;font-size:9px;line-height:1.55">
              Un deck régulier évite les mains injouables. Les Ultra et Secret ont plus de budget de stats mais demandent davantage d’énergie.
            </p>
          </aside>
        </div>
      </section>
    `
  }

  function renderDuel() {
    if (!battle) {
      return `
        <section class="tcg-panel">
          <div class="tcg-panel-pad tcg-duel">
            <div class="tcg-empty">
              <b>
                Duel TCG · 24 PV
              </b>

              12 cartes · énergie 1→5 · un affrontement de cartes par tour.
              Le coût compense la puissance des raretés élevées.
            </div>

            <div class="tcg-duel-actions">
              <button
                class="tcg-primary"
                data-action="tcg-start-duel"
                type="button"
                ${ownedRows().reduce((sum,row)=>sum+Math.min(Number(row.copies)||0,MAX_COPY_IN_DECK),0) >= DECK_SIZE ? '' : 'disabled'}
              >
                LANCER UN DUEL
              </button>
            </div>
          </div>
        </section>
      `
    }

    return `
      <section class="tcg-panel">
        <div class="tcg-panel-pad tcg-duel">
          <div class="tcg-energy">
            TOUR ${battle.turn} · ÉNERGIE ${battle.energy}/5
          </div>

          <div class="tcg-duel-board">
            <div class="tcg-hp-row">
              <div class="tcg-hp">
                <header>
                  <span>
                    ${esc(currentAthlete()?.name || 'Toi')}
                  </span>
                  <b>
                    ${battle.playerHp} PV
                  </b>
                </header>

                <div class="tcg-hp-track">
                  <i style="width:${Math.max(0,battle.playerHp/START_HP*100)}%"></i>
                </div>
              </div>

              <div class="tcg-hp">
                <header>
                  <span>
                    GA Rival
                  </span>
                  <b>
                    ${battle.aiHp} PV
                  </b>
                </header>

                <div class="tcg-hp-track">
                  <i style="width:${Math.max(0,battle.aiHp/START_HP*100)}%"></i>
                </div>
              </div>
            </div>

            <div class="tcg-battle-center">
              <div class="tcg-battle-slot">
                ${battle.playerCard
                  ? renderCard(
                      battle.playerCard
                    )
                  : ''
                }
              </div>

              <div class="tcg-versus">
                VS
              </div>

              <div class="tcg-battle-slot">
                ${battle.aiCard
                  ? renderCard(
                      battle.aiCard
                    )
                  : ''
                }
              </div>
            </div>

            <div class="tcg-battle-log">
              ${esc(battle.log)}
            </div>
          </div>

          ${battle.finished
            ? `
              <div class="tcg-duel-actions">
                <button
                  class="tcg-primary"
                  data-action="tcg-start-duel"
                  type="button"
                >
                  REVANCHE
                </button>
              </div>
            `
            : `
              <div class="tcg-hand">
                ${battle.playerHand
                  .map(
                    card =>
                      renderCard(
                        card,
                        {
                          action:
                            'tcg-play-card',
                          locked:
                            card.cost >
                            battle.energy,
                        }
                      )
                  )
                  .join('')}
              </div>
            `
          }
        </div>
      </section>
    `
  }

  function render() {
    const athlete =
      currentAthlete()

    root.innerHTML = `
      <main class="tcg-app">
        <div class="tcg-shell">
          <header class="tcg-top">
            <button
              class="tcg-back"
              data-action="tcg-back"
              type="button"
            >
              ← Arcade
            </button>

            <div>
              <small>
                GA COACHING · TCG
              </small>

              <h1>
                GA Trading Card Game
              </h1>
            </div>

            <div class="tcg-spacer"></div>

            ${options.allowAthleteSelection
              ? `
                <select
                  class="tcg-athlete-select"
                  data-action="tcg-athlete"
                >
                  ${athletes
                    .map(
                      item => {
                        const slug =
                          athleteSlug(
                            item
                          )

                        return `
                          <option
                            value="${esc(slug)}"
                            ${slug === activeSlug ? 'selected' : ''}
                          >
                            ${esc(item.name)}
                          </option>
                        `
                      }
                    )
                    .join('')}
                </select>
              `
              : ''
            }

            <div class="tcg-chip">
              🎴
              <b>
                ${Number(profile.unopened_packs) || 0}
              </b>
            </div>
          </header>

          <section class="tcg-hero">
            <div>
              <span class="tcg-kicker">
                ENTRAÎNE-TOI · OUVRE · COLLECTIONNE · JOUE
              </span>

              <h2>
                Les athlètes deviennent des cartes.
              </h2>

              <p>
                Une séance terminée = un booster gagné. Chaque personne possède cinq versions, de Commune à Secret Rare. Les cartes rares gagnent du budget de stats, mais leur coût d’énergie augmente pour garder les duels équilibrés.
              </p>
            </div>

            <div class="tcg-hero-stats">
              <div class="tcg-hero-stat">
                <span>Booster(s)</span>
                <b><em>${Number(profile.unopened_packs) || 0}</em></b>
              </div>

              <div class="tcg-hero-stat">
                <span>Ouverts</span>
                <b>${Number(profile.opened_packs) || 0}</b>
              </div>

              <div class="tcg-hero-stat">
                <span>Cartes uniques</span>
                <b>${uniqueOwned()}</b>
              </div>

              <div class="tcg-hero-stat">
                <span>Copies</span>
                <b>${totalCopies()}</b>
              </div>
            </div>
          </section>

          <nav class="tcg-nav">
            ${[
              ['boosters','🎴 Boosters'],
              ['collection','✦ Collection'],
              ['deck','▦ Deck'],
              ['duel','⚔ Duel'],
            ]
              .map(
                ([id,label]) => `
                  <button
                    class="${tab === id ? 'active' : ''}"
                    data-action="tcg-tab"
                    data-tab="${id}"
                    type="button"
                  >
                    ${label}
                  </button>
                `
              )
              .join('')}
          </nav>

          ${error
            ? `
              <div class="tcg-error">
                ${esc(error)}
              </div>
            `
            : ''
          }

          ${loading
            ? `
              <section class="tcg-panel">
                <div class="tcg-empty">
                  <b>Chargement du TCG…</b>
                </div>
              </section>
            `
            : tab === 'boosters'
              ? renderBoosters()
              : tab === 'collection'
                ? renderCollection()
                : tab === 'deck'
                  ? renderDeck()
                  : renderDuel()
          }
        </div>
      </main>
    `
  }

  root.onclick =
    async event => {
      const action =
        event.target.closest(
          '[data-action]'
        )

      if (!action) {
        return
      }

      switch (
        action.dataset.action
      ) {
        case 'tcg-back':
          options.onBack?.()
          return

        case 'tcg-tab':
          tab =
            action.dataset.tab ||
            'boosters'
          error = ''
          render()
          return

        case 'tcg-select-booster':
          selectedBooster =
            boosters.find(
              booster =>
                booster.id ===
                action.dataset.boosterId
            ) ||
            selectedBooster
          render()
          return

        case 'tcg-open-pack':
          await openPack()
          return

        case 'tcg-close-reveal':
          lastOpened = []
          render()
          return

        case 'tcg-rarity-filter':
          rarityFilter =
            action.dataset.rarity ||
            'all'
          render()
          return

        case 'tcg-add-card':
          addToDeck(
            action.dataset.cardId
          )
          return

        case 'tcg-remove-card':
          removeFromDeck(
            action.dataset.cardId
          )
          return

        case 'tcg-auto-deck':
          deck =
            autoDeck(
              collection,
              catalog
            )
          render()
          return

        case 'tcg-save-deck':
          await saveDeck()
          return

        case 'tcg-start-duel':
          beginBattle()
          return

        case 'tcg-play-card':
          playBattleCard(
            action.dataset.cardId
          )
          return
      }
    }

  root.onchange =
    event => {
      const input =
        event.target

      if (
        input.dataset.action ===
          'tcg-athlete'
      ) {
        activeSlug =
          String(
            input.value ||
            ''
          ).toLowerCase()

        void loadState()
      }
    }

  render()
  await loadState()
}
