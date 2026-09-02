import { fold } from './ui';

/**
 * Turkish ↔ English words for the things dishes are made of, so a search for
 * "patlıcan" finds a dish whose ingredient list says "large aubergines", and
 * "walnut" finds "ceviz" in a Turkish name. Each group is a set of synonyms;
 * matching one member of a group searches for all of them.
 *
 * Only ingredients that actually appear in the catalogue need an entry, but
 * extra words are harmless — add them as dishes are added.
 */
export const SYNONYMS: string[][] = [
  // Vegetables & greens
  ['patlıcan', 'aubergine', 'eggplant'],
  ['domates', 'tomato'],
  ['salatalık', 'hıyar', 'cucumber'],
  ['biber', 'pepper'],
  ['pul biber', 'chilli flakes', 'chili flakes', 'red pepper flakes'],
  ['biber salçası', 'pepper paste'],
  ['salça', 'tomato paste'],
  ['soğan', 'onion'],
  ['taze soğan', 'spring onion', 'scallion'],
  ['sarımsak', 'garlic'],
  ['patates', 'potato'],
  ['kabak', 'courgette', 'zucchini'],
  ['kabak çiçeği', 'courgette flower', 'squash blossom'],
  ['havuç', 'carrot'],
  ['kereviz', 'celeriac', 'celery'],
  ['pırasa', 'leek'],
  ['bamya', 'okra'],
  ['enginar', 'artichoke'],
  ['mantar', 'mushroom'],
  ['turp', 'radish'],
  ['pancar', 'beetroot', 'beet'],
  ['lahana', 'cabbage'],
  ['ıspanak', 'spinach'],
  ['pazı', 'chard', 'swiss chard'],
  ['semizotu', 'purslane'],
  ['roka', 'rocket', 'arugula'],
  ['marul', 'kıvırcık', 'lettuce'],
  ['maydanoz', 'parsley'],
  ['dereotu', 'dill'],
  ['nane', 'mint'],
  ['kekik', 'thyme', 'oregano'],
  ['zahter', 'wild thyme', 'zaatar'],
  ['arapsaçı', 'wild fennel', 'fennel'],
  ['radika', 'chicory'],
  ['ebegümeci', 'mallow'],
  ['şevketibostan', 'blessed thistle'],
  ['deniz börülcesi', 'samphire', 'glasswort'],
  ['ot', 'otlar', 'herbs', 'wild greens'],
  ['turşu', 'pickle', 'pickled'],
  ['kuru domates', 'sun-dried tomato'],
  ['bezelye', 'pea', 'peas'],
  ['kornişon', 'gherkin'],
  ['hardal otu', 'mustard greens'],
  ['asma yaprağı', 'yaprak', 'vine leaf', 'vine leaves'],

  // Pulses & grains
  ['nohut', 'chickpea'],
  ['mercimek', 'lentil'],
  ['fasulye', 'bean'],
  ['barbunya', 'borlotti'],
  ['bakla', 'broad bean', 'fava bean'],
  ['bulgur', 'cracked wheat'],
  ['pirinç', 'rice'],
  ['un', 'flour'],
  ['irmik', 'semolina'],
  ['mısır unu', 'cornmeal', 'polenta'],
  ['ekmek', 'bread', 'loaf'],
  ['yufka', 'filo', 'phyllo', 'pastry'],
  ['lavaş', 'bazlama', 'flatbread'],
  ['galeta unu', 'breadcrumb'],

  // Dairy & eggs
  ['yoğurt', 'yogurt', 'yoghurt'],
  ['süzme', 'strained yoghurt', 'strained yogurt'],
  ['peynir', 'cheese'],
  ['beyaz peynir', 'white cheese', 'feta'],
  ['kaşar', 'kasseri'],
  ['tulum', 'tulum cheese'],
  ['çökelek', 'curd cheese'],
  ['lor', 'ricotta'],
  ['hellim', 'halloumi'],
  ['kaymak', 'clotted cream'],
  ['tereyağı', 'butter'],
  ['süt', 'milk'],
  ['yumurta', 'egg'],

  // Nuts, oils & seasoning
  ['ceviz', 'walnut'],
  ['fıstık', 'antep fıstığı', 'pistachio'],
  ['badem', 'almond'],
  ['fındık', 'hazelnut'],
  ['çam fıstığı', 'pine nut'],
  ['susam', 'sesame'],
  ['tahin', 'tahini'],
  ['zeytinyağı', 'olive oil'],
  ['zeytin', 'olive'],
  ['ayçiçek yağı', 'sunflower oil'],
  ['sirke', 'vinegar'],
  ['limon', 'lemon'],
  ['portakal', 'orange'],
  ['nar', 'pomegranate'],
  ['nar ekşisi', 'pomegranate molasses'],
  ['sumak', 'sumac'],
  ['kimyon', 'cumin'],
  ['karabiber', 'black pepper'],
  ['tarçın', 'cinnamon'],
  ['yenibahar', 'allspice'],
  ['karanfil', 'clove'],
  ['toz biber', 'paprika'],
  ['tuz', 'salt'],
  ['şeker', 'sugar'],
  ['bal', 'honey'],
  ['reçel', 'jam'],
  ['kabartma tozu', 'baking powder'],
  ['bira', 'beer'],
  ['soda', 'sparkling water', 'fizzy water'],
  ['defne', 'bay leaf'],
  ['hardal', 'mustard'],
  ['mayonez', 'mayonnaise'],
  ['kişniş', 'coriander'],
  ['kuyruk yağı', 'tail fat'],

  // Fruit
  ['incir', 'fig'],
  ['kayısı', 'apricot'],
  ['kavun', 'melon'],
  ['karpuz', 'watermelon'],
  ['üzüm', 'grape'],
  ['kuru üzüm', 'currant', 'raisin', 'sultana'],
  ['elma', 'apple'],
  ['meyve', 'fruit'],

  // Meat, offal & charcuterie
  ['et', 'meat'],
  ['kıyma', 'mince', 'minced', 'ground meat'],
  ['kuzu', 'lamb'],
  ['tavuk', 'chicken'],
  ['dana', 'beef', 'veal'],
  ['ciğer', 'liver'],
  ['dil', 'tongue'],
  ['beyin', 'brain'],
  ['uykuluk', 'sweetbread'],
  ['bağırsak', 'intestine'],
  ['pastırma', 'cured beef'],
  ['sucuk', 'garlic sausage'],

  // Fish & seafood
  ['balık', 'fish'],
  ['hamsi', 'anchovy', 'anchovies'],
  ['uskumru', 'mackerel'],
  ['palamut', 'torik', 'bonito'],
  ['lakerda', 'cured bonito'],
  ['çiroz', 'dried mackerel'],
  ['levrek', 'sea bass'],
  ['sardalya', 'sardine'],
  ['karides', 'prawn', 'shrimp'],
  ['midye', 'mussel'],
  ['kalamar', 'squid', 'calamari'],
  ['ahtapot', 'octopus'],
  ['tarama', 'cod roe', 'fish roe'],
];

/** term (folded) -> every folded term in its group. Built once, lazily. */
let index: Map<string, string[]> | null = null;

function getIndex() {
  if (index) return index;
  index = new Map();
  for (const group of SYNONYMS) {
    const folded = group.map(fold);
    for (const term of folded) {
      const seen = index.get(term) ?? [];
      index.set(term, [...new Set([...seen, ...folded])]);
    }
  }
  return index;
}

/**
 * All the folded needles a query should be tried against: the query itself
 * plus the other-language names of any ingredient word it looks like the
 * start of ("patli" -> "patlıcan" -> "aubergine", "eggplant").
 */
export function needles(query: string): string[] {
  const needle = fold(query.trim());
  if (needle.length < 2) return needle ? [needle] : [];
  const out = new Set([needle]);
  for (const [term, group] of getIndex()) {
    // A word of the term must start with the query, so "et" (meat) doesn't drag in beetroot.
    if (term.startsWith(needle) || term.split(' ').some((w) => w.startsWith(needle))) {
      for (const t of group) out.add(t);
    }
  }
  return [...out];
}
