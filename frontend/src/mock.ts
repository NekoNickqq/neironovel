import { Dialogue, Message, TextBlock, CharacterCard, DialogueSettings } from './types';
import { DEMO_IMAGES, getRandomDemoImage } from './demoImages';

export function createMockDialogue(): Dialogue {
  const dialogueId = 'dialogue-1';
  const characters: CharacterCard[] = [
    {
      id: 'char-1',
      name: 'Каэль',
      description: 'Тёмный маг с серебряными волосами, носит чёрный плащ с рунами',
      avatar_path: null,
      color: '#8b5cf6',
    },
    {
      id: 'char-2',
      name: 'Лира',
      description: 'Эльфийка-следопыт с зелёными глазами и луком из лунного дерева',
      avatar_path: null,
      color: '#34d399',
    },
  ];

  const settings: DialogueSettings = {
    world_lore: `Тёмное фэнтези мир под названием Эрданор. Древние руны дают силу, но забирают душу. 
    Королевство Вельмар пало под натиском Тени, и лишь горстка героев ищет способ восстановить Великий Кристалл.
    Магия здесь опасна — каждое заклинание оставляет след на душе заклинателя.`,
    character_cards: characters,
    style_preset: 'dark fantasy, cinematic lighting, masterpiece, best quality, 8k, dramatic shadows',
    font_config: {
      narrator: 'Cinzel, Georgia, serif',
      user: 'Inter, sans-serif',
      hero: 'Roboto, sans-serif',
      sidekick: 'Open Sans, sans-serif',
    },
    ai_controls_user: false,
  };

  const messages: Message[] = [
    {
      id: 'msg-1',
      dialogue_id: dialogueId,
      role: 'assistant',
      blocks: [
        { speaker: 'narrator', text: '*Туман стелется между разрушенными колоннами древнего храма. В воздухе пахнет озоном и старой магией. Где-то вдалеке слышен вой — не звериный, а скорее... плачущий.*' },
        { speaker: 'hero', text: 'Мы на месте. Кристалл должен быть где-то здесь, под алтарём.' },
        { speaker: 'sidekick', text: 'Каэль, я чувствую что-то... Это место неправильное. Камни шепчут.' },
      ],
      image_path: DEMO_IMAGES[0],
      image_variants: [DEMO_IMAGES[0], DEMO_IMAGES[1]],
      selected_image_index: 0,
      has_image: true,
      text_versions: [],
      selected_version_index: 0,
      parent_id: null,
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'msg-2',
      dialogue_id: dialogueId,
      role: 'user',
      blocks: [{ speaker: 'user', text: 'Осторожно осмотреть алтарь, ища скрытые механизмы или ловушки' }],
      image_path: null,
      image_variants: [],
      selected_image_index: 0,
      has_image: false,
      text_versions: [],
      selected_version_index: 0,
      parent_id: 'msg-1',
      created_at: '2024-01-15T10:01:00Z',
    },
    {
      id: 'msg-3',
      dialogue_id: dialogueId,
      role: 'assistant',
      blocks: [
        { speaker: 'narrator', text: '*Ты подходишь к алтарю. Каменная плита покрыта пылью веков. Когда ты проводишь рукой по поверхности, руны начинают слабо светиться фиолетовым.*' },
        { speaker: 'hero', text: 'Стой! Не трогай центральную руну — это может быть печать. Дай мне минуту, я проверю...' },
        { speaker: 'sidekick', text: '*Лира натягивает тетиву, оглядываясь* Каэль, hurry up. Что-то приближается. Я слышу шаги — много шагов.' },
      ],
      image_path: DEMO_IMAGES[2],
      image_variants: [DEMO_IMAGES[2], DEMO_IMAGES[3]],
      selected_image_index: 0,
      has_image: true,
      text_versions: [],
      selected_version_index: 0,
      parent_id: 'msg-2',
      created_at: '2024-01-15T10:02:00Z',
    },
    {
      id: 'msg-4',
      dialogue_id: dialogueId,
      role: 'user',
      blocks: [{ speaker: 'user', text: 'Быстро активировать защитный барьер, пока Лира прикрывает' }],
      image_path: null,
      image_variants: [],
      selected_image_index: 0,
      has_image: false,
      text_versions: [],
      selected_version_index: 0,
      parent_id: 'msg-3',
      created_at: '2024-01-15T10:03:00Z',
    },
    {
      id: 'msg-5',
      dialogue_id: dialogueId,
      role: 'assistant',
      blocks: [
        { speaker: 'narrator', text: '*Ты вскидываешь руки, и из ладоней вырываются нити тёмной энергии. Они сплетаются в купол вокруг алтаря — мерцающий, полупрозрачный щит. В этот момент из тумана выходят они — Теневые Охотники, безликие фигуры с горящими красными глазами.*' },
        { speaker: 'sidekick', text: '*Стрела за стрелой летит из лука Лиры, каждая находит цель, но тени поглощают попадания* Их слишком много! Каэль, щит не выдержит долго!' },
        { speaker: 'hero', text: '*Руны вспыхивают* Нашёл! Кристалл — он внутри алтаря. Но чтобы достать его, нужно снять печать... А для этого мне нужны тридцать секунд. И живая защита.' },
      ],
      image_path: DEMO_IMAGES[4],
      image_variants: [DEMO_IMAGES[4], DEMO_IMAGES[5]],
      selected_image_index: 0,
      has_image: true,
      text_versions: [],
      selected_version_index: 0,
      parent_id: 'msg-4',
      created_at: '2024-01-15T10:04:00Z',
    },
  ];

  return {
    id: dialogueId,
    title: 'Храм Забытых Рун',
    description: 'Тёмное фэнтези приключение в мире Эрданор',
    settings,
    messages,
    created_at: '2024-01-15T09:00:00Z',
  };
}

const AI_RESPONSES: { blocks: TextBlock[]; image_prompt: string }[] = [
  {
    blocks: [
      { speaker: 'narrator', text: '*Щит трещит под ударами теневых когтей. Фиолетовые искры разлетаются в стороны. Лира отступает к алтарю, её лук светится лунным серебром.*' },
      { speaker: 'sidekick', text: 'Каэль! Щит на пределе! Я могу продержать нас ещё минуту, но потом...' },
      { speaker: 'hero', text: '*Печать начинает раскручиваться, руны вращаются* Почти... почти готово! Ещё чуть-чуть!' },
    ],
    image_prompt: 'dark fantasy temple interior, magical shield cracking under shadow creature attacks, purple sparks flying, elf archer with glowing bow, hooded mage at stone altar with spinning runes, dramatic lighting, cinematic, masterpiece, best quality, 8k',
  },
  {
    blocks: [
      { speaker: 'narrator', text: '*В этот момент алтарь раскалывается. Из трещины вырывается ослепительный белый свет — Великий Кристалл, пульсирующий как живое сердце. Теневые Охотники отшатываются, их формы начинают растворяться.*' },
      { speaker: 'hero', text: '*Каэль хватает кристалл, его глаза горят* Я... я чувствую его силу. Она огромна. Но она требует цену...' },
      { speaker: 'sidekick', text: '*Лира опускает лук, глядя на Каэля с тревогой* Какая цена? Каэль, что ты чувствуешь?' },
    ],
    image_prompt: 'dark fantasy temple, cracked stone altar with blinding white crystal emerging, shadow creatures dissolving in light, hooded mage holding glowing crystal with haunted expression, elf woman looking concerned, divine light beams, epic composition, masterpiece, best quality, 8k',
  },
  {
    blocks: [
      { speaker: 'narrator', text: '*Тишина. Тени рассеялись, оставив после себя лишь чёрный пепел. Кристалл в руках Каэля пульсирует тёплым золотистым светом — совсем не таким, каким он должен быть.*' },
      { speaker: 'hero', text: 'Он... изменился. Когда я коснулся его, что-то перемешалось. Теперь в нём и тьма, и свет. Как во мне.' },
      { speaker: 'sidekick', text: '*Лира подходит ближе, протягивая руку, но останавливается* Это... нормально? Кристалл не должен быть таким.' },
    ],
    image_prompt: 'dark fantasy aftermath, destroyed temple ruins, calm atmosphere, hooded mage holding crystal that glows with mixed gold and purple light, elf woman approaching cautiously, ashes floating in air, soft divine light from above, emotional scene, masterpiece, best quality, 8k',
  },
];

let responseIndex = 0;

export function generateAIResponse(): { blocks: TextBlock[]; image_prompt: string } {
  const response = AI_RESPONSES[responseIndex % AI_RESPONSES.length];
  responseIndex++;
  return response;
}

export function getRandomImage(): string {
  return getRandomDemoImage();
}
