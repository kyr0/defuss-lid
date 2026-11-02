/**
 * Letters that set languages apart: one line per language, `<code> <letters>`, read by `letterSupport` (boost.ts).
 *
 * How to read a line (the rules that keep the table small):
 * - Latin script: the letters a language uses outside ASCII a–z (`de äöüß`). A line without letters writes basic
 *   Latin (`en`).
 * - Other scripts: the letters only some languages of that script use (`ru` lists ы and э, `uk` lists ї and є) plus
 *   one letter of each script the language writes (`el α`). Letters every language of a script uses are left out:
 *   an unlisted letter counts for every language of its script, so listing it everywhere would change nothing.
 * - Han: the 120 most frequent characters that not all of Simplified Chinese, Traditional Chinese, Japanese and
 *   Cantonese text use (FLORES-200 dev), each listed for every variant that uses it; Wu (`wuu`) follows Simplified
 *   Chinese. Cantonese and Wu also list particles of their colloquial written forms (嘅, 侬).
 *
 * Codes: the 176 labels of fastText `lid.176` and the 17 CLD3 labels it lacks.
 *
 * Why only distinguishing letters instead of full alphabets: the same `letterSupport` at 40% of the bytes (4.8 kB
 * against 12.0 kB raw).
 * VERIFIED: this table and the full alphabets it was compacted from give identical `letterSupport` for all 193
 * languages on 10,390,734 (text, language) pairs from FLORES-200 dev; each language's own FLORES-200 dev sentences fit
 * another language's letters better in at most 2.3% of cases (Malagasy and Indonesian, from letters such as é and ã
 * that their orthographies lack), 2026-11-02.
 *
 * @module
 */
export const CHARSETS = `af áèéêëíîïóôúûŉ
als äöü
am ሀ
an áéíñóúü
ar ءآأؤإاةثحذصضطظعكهىي
arz ءآأؤإاةثحذصضطظعكهىي
as অৰৱ
ast áéíñóúüḥḷ
av аийцщъыьэюяёӏ
az çöüğışə
azb ءآأؤاثحذصضطظعهپچژکگۀۆی
ba аийцщъыьэюяёғҙҡңҫүһәө
bar ßäåöü
bcl
be айцыьэюяёіў
bg аийцщъьюя
bg-Latn
bh अऑॉ
bn অর
bo ཀ
bpy অরৱ
br âêîñôùûü
bs ćčđšž
bxr аийцщъыьэюяёүһө
ca àçèéíïòóúü
cbk áéíñóú
ce аийцщъыьэюяёӏ
ceb
ckb احعهپچڕژڤکگڵۆیێە
co àèìòù
cs áéíóúýčďěňřšťůž
cv аийцщъыьэюяёҫӑӗӳ
cy áâêîïôûŵŷ
da åæéø
de ßäöü
diq çêîûğış
dsb óćčěłńŕśšźž
dty अ
dv ހ
el α
el-Latn
eml àâèéêëìòóôù
en
eo ĉĝĥĵŝŭ
es áéíñóúü
et äõöüšž
eu ñ
fa ءآأاثحذصضطظعهپچژکگۀی
fi äöšž
fr àâæçèéêëîïôùûüÿœ
frr äåöü
fy âäéêëïôöúû
ga áéíóú
gd àèìòù
gl áéíñóúü
gn áãéíñóõúýĩũẽỹ
gom अळॅॉ
gu અ
gv ç
ha ƙƴɓɗ
haw āēīōūʻ
he א
hi अऑॉ
hi-Latn
hif
hmn
hr ćčđšž
hsb óćčěłńřšźž
ht àèò
hu áéíóöúüőű
hy ա
ia
id
ie
ig àáèéìíòóùúṅịọụ
ilo
io
is áæéíðóöúýþ
it àèéìòù
ja ぁァー与並会体係個内動区員国場学将当後数時来機為現発着称種許該語車進遊過達長開間電馬
ja-Latn āēīōū
jbo
jv èé
ka ა
kk аийцщъыьэюяёіғқңүұһәө
km ក
kn ಅ
ko ㄱ
krc аийцщъыьэюяёў
ku çêîûş
kv аийцщъыьэюяёіӧ
kw
ky аийцщъыьэюяёңүө
la
lb äéëöü
lez аийцщъыьэюяёӏ
li àäèéëìïòóöù
lmo àçèéìòóöùüœ
lo ກ
lrc ءآأاثحذصضطظعهپچژکگۀی
lt ąčėęįšūųž
lv āčēģīķļņšūž
mai अऑॉ
mg àéô
mhr аийцщъыьэюяёҥӧӱ
mi āēīōū
min
mk аицѓѕјљњќџ
ml അ
mn аийцщъыьэюяёүө
mr अऑऱळॅॉॲ
mrj аийцщъыьэюяёӓӧӱӹ
ms
mt àèìòùċġħż
mwl áâãçéêíóôõú
my က
myv аийцщъыьэюяё
mzn ءآأاثحذصضطظعهپچژکگۀی
nah
nap àèéìòóù
nds ßäöü
ne अ
new अ
nl èéëïöü
nn åæéòø
no åæéø
ny ŵ
oc àáçèéíïòóúü
or ଅ
os аийцщъыьэюяёӕ
pa ਅ
pam
pfl ßäöü
pl óąćęłńśźż
pms àèéëìòù
pnb ءآأؤاثحذصضطظعٹپچڈڑژکگںھہۃیےݨ
ps آأاثحذصضطظعهيټپځڅچډړږژښکګڼیۍې
pt àáâãçéêíóôõú
qu áéíñóú
rm àäèéìòöùü
ro âîăşţșț
ru аийцщъыьэюяё
ru-Latn
rue аийцщъыьэюяёєіїґ
sa अऌऑऽॄॉॐॠ
sah аийцщъыьэюяёҕҥүһө
sc àèìòù
scn àâèêìîòôùûḍ
sco
sd ءآاثحذصضطظعهيٺٻٽپٿڀڃڄچڇڊڌڍڏڙڦکڪگڱڳڻھہی
sh ćčđšž
si අ
sk áäéíóôúýčďĺľňŕšťž
sl čšž
sm āēīōūʻ
sn
so
sq çë
sr ćčđšžаицђјљњћџ
st
su é
sv äåéö
sw
ta ஃ
te అ
tg аийъэюяёғқҳҷӣӯ
th ก
tk äçöüýňşž
tl
tr âçîöûüğış
tt аийцщъыьэюяёҗңүһәө
tyv аийцщъыьэюяёңүө
ug اكىيپچژڭگھۆۇۈۋېە
uk аийцщьюяєіїґ
ur ءآأؤاثحذصضطظعٹپچڈڑژکگںھہۃیے
uz ʻ
vec àèéìíòóùł
vep äöüčšž
vi àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ
vls èéêëïôöü
vo äöü
wa âåçèéêîôû
war
wuu 㑚与个为之也于亚些从们会伲但体你侬克其内动区发只后咾国场如学它对将尔已并开当很德或拉搿数斯时是来此没游现电着种称经罗而覅许该语车达过还这进迭里长间需
xal аийцщъыьэюяёҗңүһәө
xh
xmf აჲჷ
yi ַָּֿאװױײ
yo àáèéìíòóùúńǹḿṣẹọ
yue 並之乜也些亞亦但你佢來係個們克內其冇動區只咁咗哋員唔啱啲喺嗰嘅嘞嘢噉嚟國場如學它將對已帶很後從德或拉揾攞數斯於是時會機此沒游為爾現畀當發睇種稱經羅而與蘭許該語說賽車這進遊過達里長開間電需馬體
zh 与並个为之也于亚些亞亦从们会但体你來係個們克內其内动動区區发只后員国國场場如学學它对将將對尔已帶并开当很後從德或拉数數斯於时是時會来機此沒没游為爾现現电當發着种称種稱經经罗羅而與蘭許該語說许该语賽車车达过还这进這進遊過達里長长開間间電需馬體
zh-Latn àáèéìíòóùúüāēěīōūǎǐǒǔǖǘǚǜ
zu
`;
