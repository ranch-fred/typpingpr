// Lowercase a-z words only. The first 200 are the most common ("easy" pool).
(function (root) {
  'use strict';
  const RAW = `
the of and to in is you that it he was for on are as with his they at be this have from or one
had by word but not what all were we when your can said there use an each which she do how their
if will up other about out many then them these so some her would make like him into time has look
two more write go see number no way could people my than first water been call who oil its now find
long down day did get come made may part over new sound take only little work know place year live
me back give most very after thing our just name good man think say great where help through much
before line right too mean old any same tell boy follow came want show also around form three small
set put end does another well large must big even such because turn here why ask went men read need
land home us move try kind hand again change off play air away house point page letter mother answer
found study still learn should world high every near add food own below plant last school father keep
tree never start city earth eye light head under story saw left few while along might close seem next
hard open life always those both paper got group often run until side feet car night walk white sea
began grow took river four carry state once book hear stop second later miss idea enough eat face
watch far really almost let above girl talk soon list song leave family body music color stand sun
fish area mark dog horse bird problem room knew since ever piece told easy heard order red door sure
become top ship across today short better best low hours black whole early wind rock space fast hold
toward five step morning true hundred table north money map farm draw voice seen cold plan south sing
ground fall king town figure field travel wood fire upon done road half ten fly gave box wait person
strong front feel fact street course nothing rest inside stay green known island week less base ago
stood plane system behind ran round boat game force brought warm common bring dry though shape deep
yes clear yet filled heat full hot check rule power cannot able six size dark ball special heavy fine
pair circle include built quick quiet quite question queen quiz quote equal square squeeze quality
quarter liquid unique request require zero zone prize lazy crazy freeze amazing puzzle dozen frozen
breeze organize realize maze zip fox mix fix text extra exact explain expect example relax taxi wax
tax index exit expert job joy jump join judge major enjoy object project jacket jelly jungle juice
jar key kick knee knife kitchen kite bike like black visit value view vote video seven love level
allow alone already although among amount angry animal anyone anything appear apple arm army arrive
art attack aunt autumn baby bad bag bank basket bath bear beat beautiful bed bee believe bell belong
bench beside between birth bit bite bitter blood blow blue board bone bottle bottom brain branch
bread break breakfast bridge bright brother brown brush build burn business busy butter button buy
cake camera candle cap captain card care careful case cat catch cause chair chance cheap cheese
chicken child chin choose church clean clock cloth cloud coat coffee coin collect comb company
compare cook cool copy corner cost cotton cough count cover cow cream cross crowd cry cup curtain
curve damage danger date daughter dead dear death decide degree desk dinner dirty discover dish
doctor dollar dream dress drink drive drop dust duty eager ear egg elbow empty enemy energy engine
enter evening event exam fail fair false famous fancy farmer fat fault fear feather fever film
finger finish flag flame flat floor flower foot forest forget fork frame free fresh fruit future
garden gate gentle gift glass glove goat gold grass gray grip guess guide habit hair hammer happy
harbor hat hate health heart hill history hole holiday honest hook hope horn hospital hotel hour
human humor hunger hurry ice ink iron jewel journey kettle kiss lake lamp laugh law lead leaf
leather lemon lesson library lift limit lip lock loose loud luck lunch magic market marry match meal
meat medicine meet memory metal middle milk mind minute mirror modern monkey month moon motion mouse
mouth muscle nail narrow nation nature neck needle nerve nest net news nice noise nose nurse nut
ocean offer office orange oven owner pain paint pan party past paste peace pen pencil pet pig pin
pipe plate pocket poem polish poor potato powder present price print private profit proof pump
pupil purple push rabbit rain range rat raw ray reason record remove rent reply rice rich ring risk
rope rough rub ruler sad safe sail salt sand scale science seat secret seed sell send sense serve
shade shake sharp sheep shelf shell shirt shoe shop silk silver simple sister skin skirt sky sleep
slip smile smoke snake snow soap sock soft soldier solid son soup sour spoon spring stamp star steam
steel stem stick stiff stone storm straight strange straw stream stretch sudden sugar summer support
sweet swim tail talent taste teacher thick thin thread throat thumb ticket tight tired toe tongue
tooth towel tower toy trade train trick trouble truck twist umbrella uncle valley vessel wall wash
waste wave weather wedding wet wheel whip whistle wide wife wild window wing winter wire wise woman
wonder wool worm wrist yellow young zebra
`;
  const WORDS = [...new Set(RAW.split(/\s+/).filter(Boolean))];
  if (typeof module !== 'undefined' && module.exports) module.exports = WORDS;
  else root.WORDS = WORDS;
})(this);
