# Instagram Fotoğraf Büyütme ve Yakınlaştırma Tasarımı

## Amaç

Instagram gönderileri, çoklu gönderiler (karuseller) ve fotoğraf Hikâyeleri için modern bir tam ekran görüntüleyici eklemek. Kullanıcı, fotoğraf üzerindeki kompakt büyüteç düğmesiyle görüntüleyiciyi açabilmeli; fare imlecinin altındaki noktaya akıcı biçimde yakınlaşabilmeli ve büyütülmüş fotoğrafı sürükleyerek inceleyebilmelidir.

Profil fotoğrafları, avatarlar, simgeler ve arayüz küçük resimleri kapsam dışındadır. Mevcut video kontrol davranışları değişmeyecektir.

## Kapsam

Özellik şu yüzeylerde çalışacaktır:

- Tek fotoğraflı gönderiler
- Fotoğraf içeren çoklu gönderiler
- Fotoğraf Hikâyeleri

Video yüzeylerine büyüteç eklenmeyecektir. Profil ızgarasındaki küçük önizlemeler, profil fotoğrafları, avatarlar, simgeler, öneri küçük resimleri ve Instagram arayüzüne ait görseller kapsam dışıdır.

## Mimari

Fotoğraf özelliği, mevcut video modüllerinden bağımsız dört birime ayrılacaktır:

- `photo-discovery`: Instagram sayfasına eklenen uygun içerik fotoğraflarını bulur ve kaldırılan görselleri serbest bırakır.
- `zoom-trigger`: Uygun fotoğrafın kapsayıcısına kompakt büyüteç düğmesini ekler ve temizler.
- `photo-viewer`: Tam ekran katmanı, fotoğraf yüzeyini, kapatma, yakınlaştırma, sıfırlama ve karusel gezinme kontrollerini oluşturur.
- `photo-controller`: Akıcı yakınlaştırma matematiğini, sürükleme hareketini, klavyeyi, karusel geçişini ve Hikâye durdurma/devam ettirme yaşam döngüsünü yönetir.

`content.js`, video keşfine ek olarak fotoğraf keşfini başlatacak ve eklenti durdurulduğunda her iki özelliğin kaynaklarını temizleyecektir. Fotoğraf modülleri video denetleyicilerine veya video görünümüne bağımlı olmayacaktır.

## Fotoğraf Keşfi

Keşif yalnızca CSS sınıf adlarına dayanmayacaktır. Aday görseller aşağıdaki sinyaller birlikte değerlendirilerek seçilecektir:

- Görselin ekranda anlamlı bir içerik alanı kaplaması
- Bir gönderi, karusel veya Hikâye medya alanında bulunması
- Kaynağının ve en-boy oranının içerik fotoğrafıyla uyumlu olması
- Aynı medya alanında aktif bir video bulunmaması

Küçük boyutlu görseller, dairesel avatarlar, profil bağlantılarındaki görseller, simgeler ve görünmeyen karusel slaytları elenecektir. `MutationObserver`, ilk taramadan sonra yalnızca eklenen düğümleri inceleyecektir. Instagram aynı görseli başka bir kapsayıcıya taşıdığında eski tetikleyici temizlenip yeni kapsayıcıya bağlanacaktır.

## Büyüteç Tetikleyicisi

- Uygun fotoğrafın sağ üst köşesinde küçük bir büyüteç düğmesi bulunacaktır.
- Düğme yarı saydam, kompakt ve mevcut buz mavisi vurgu rengiyle uyumlu olacaktır.
- Fare fotoğraf alanına geldiğinde veya klavye odağı alındığında belirginleşecektir.
- Düğmeye basılması Instagram’ın gönderi, karusel veya Hikâye tıklama davranışını tetiklemeyecektir.
- Düğmenin erişilebilir adı Türkçe olacak ve klavyeyle çalışacaktır.

## Tam Ekran Görüntüleyici

Görüntüleyici, Instagram arayüzünün üstünde sabitlenen koyu ve yarı saydam bir katman olarak açılacaktır. Fotoğraf başlangıçta kırpılmadan kullanılabilir ekrana sığdırılacaktır.

Görüntüleyici şu kontrolleri içerecektir:

- Kapatma
- Yakınlaştırma
- Uzaklaştırma
- Görünümü sıfırlama
- Güncel yakınlaştırma oranı
- Karusel varsa önceki ve sonraki fotoğraf

Kontroller, fotoğrafı mümkün olduğunca az kaplayan kompakt bir yapıda olacaktır. `Esc`, kapatma düğmesi veya fotoğraf dışındaki boş arka plana tıklama görüntüleyiciyi kapatacaktır. Kontrollerin üzerine tıklamak kapatma davranışını tetiklemeyecektir.

Görüntüleyici açıldığında sayfa kaydırması geçici olarak engellenecek; kapanırken önceki kaydırma davranışı eksiksiz geri yüklenecektir.

## Akıcı ve İmleç Odaklı Yakınlaştırma

Yakınlaştırma sabit kademeler yerine `1×–10×` aralığında küçük, akıcı oranlarla çalışacaktır. Fare tekerleğinin her hareketinde:

1. İmlecin fotoğraf yüzeyindeki konumu görüntü koordinatına çevrilir.
2. Yeni ölçek hesaplanır ve `1×–10×` aralığına sınırlandırılır.
3. Öteleme değeri, imlecin altındaki görüntü noktası ekranda aynı yerde kalacak şekilde yeniden hesaplanır.
4. Geçiş düşük gecikmeyle uygulanır; tekerlek girdileri birikerek akıcı bir hareket üretir.

Yakınlaştırma oranı `2.35×` gibi iki ondalığa kadar gösterilecektir. `+` ve `−` kontrolleri imleç mevcut değilken fotoğraf merkezini odak alacaktır. Sıfırlama, ölçeği `1×` değerine ve fotoğrafı merkez konumuna döndürecektir.

## Sürükleme ve Sınırlar

Fotoğraf yalnızca `1×` üzerinde sürüklenebilecektir. Birincil fare düğmesiyle sürükleme sırasında görüntü, işaretçi hareketini doğrudan takip edecektir.

Öteleme sınırları, fotoğrafın tamamının görünür alan dışına kaçmasını engelleyecektir. Fotoğrafın bir eksendeki ölçeklenmiş boyutu görüntüleyiciden küçükse o eksende merkezde tutulacaktır. Büyükse en az bir kenarın görünür alana temas etmesi sağlanacaktır. Sınır düzeltmeleri ani sıçrama yerine kısa ve yumuşak bir geçişle uygulanacaktır.

## Karusel Davranışı

Karusel fotoğrafları görüntüleyici açıkken:

- Sağ-sol düğmeleriyle
- Klavyedeki sağ-sol ok tuşlarıyla

gezilebilecektir. Yalnızca mevcut Instagram medya alanına ait fotoğraflar listeye alınacaktır. Video içeren bir karusel öğesi fotoğraf görüntüleyicide açılmayacaktır. Fotoğraf değiştiğinde ölçek ve öteleme başlangıç durumuna sıfırlanacaktır.

Instagram karuselin sonraki görselini henüz DOM’a yüklememişse eklenti mevcut Instagram sonraki/önceki kontrolünü güvenli biçimde tetikleyip yeni görselin yüklenmesini bekleyecektir. Görsel bulunamazsa mevcut fotoğraf açık kalacak ve gezinme kontrolü geçici olarak devre dışı bırakılacaktır.

## Hikâye Davranışı

Fotoğraf Hikâyesinde görüntüleyici açıldığında Hikâye akışı durdurulacaktır. Eklenti, akışın görüntüleyici açılmadan önce çalışıp çalışmadığını kaydedecektir. Görüntüleyici kapandığında yalnızca eklentinin durdurduğu ve önceden ilerlemekte olan Hikâye devam ettirilecektir.

Görüntüleyici açıkken Instagram’ın ileri/geri Hikâye tıklamaları engellenecektir. Kullanıcı görüntüleyiciyi kapattıktan sonra Instagram’ın normal Hikâye kontrolleri yeniden çalışacaktır.

## Yaşam Döngüsü ve Hata Davranışı

- Açık fotoğraf DOM’dan kaldırılırsa veya Instagram sayfa yüzeyini değiştirirse görüntüleyici kapanır.
- Yüksek çözünürlüklü kaynak bulunamazsa ekranda kullanılan mevcut görsel kaynağıyla devam edilir.
- Görsel yüklenemezse kısa bir Türkçe hata durumu gösterilir ve kullanıcı görüntüleyiciyi kapatabilir.
- Aynı fotoğrafa birden fazla tetikleyici eklenmez.
- Kaldırılan fotoğrafların düğmeleri ve olay dinleyicileri temizlenir.
- Eklenti durdurulduğunda açık görüntüleyici, sayfa kaydırma kilidi ve Hikâye duraklatma durumu geri alınır.
- Bir fotoğraftaki hata diğer fotoğrafların keşfedilmesini engellemez.

## Erişilebilirlik

- Tüm düğmeler Türkçe erişilebilir adlara sahip olacaktır.
- Görüntüleyici açıldığında klavye odağı katmana taşınacak ve kapandığında büyüteç düğmesine geri dönecektir.
- Odak görüntüleyici açıkken katman içinde tutulacaktır.
- `Esc`, sağ-sol oklar, `+`, `-` ve `0` klavye kısayolları desteklenir.
- Kullanıcının azaltılmış hareket tercihi varsa yumuşak geçişler kaldırılır.

## Test ve Doğrulama

Otomatik testler aşağıdakileri kapsayacaktır:

- Gönderi, karusel ve Hikâye fotoğraflarının bulunması
- Avatar, simge, küçük resim ve video yüzeylerinin elenmesi
- Dinamik eklenen veya taşınan fotoğrafların doğru bağlanması
- Tek bir büyüteç tetikleyicisi eklenmesi ve temizlenmesi
- İmlecin altındaki görüntü noktasının yakınlaştırma boyunca sabit kalması
- `1×–10×` ölçek sınırları ve oran göstergesi
- Sürükleme ve öteleme sınırları
- Sıfırlama davranışı
- Karusel düğmeleri ve klavye geçişleri
- Hikâyeyi durdurma ve yalnızca gerektiğinde sürdürme
- Sayfa kaydırma kilidinin geri alınması
- DOM kaldırma ve sayfa geçişi temizliği
- Mevcut video kontrol testlerinin regresyon olarak geçmesi

Manuel doğrulama gerçek Instagram üzerinde tek fotoğraflı gönderi, fotoğraf karuseli ve fotoğraf Hikâyesiyle yapılacaktır. İmleç odaklı yakınlaştırma, `10×` üst sınırı, sürükleme, klavye, odak yönetimi ve mevcut video kontrolleri ayrıca kontrol edilecektir.

## Kabul Kriterleri

1. Büyüteç yalnızca gönderi, karusel ve fotoğraf Hikâyesindeki içerik fotoğraflarında görünür.
2. Büyüteç Instagram’ın normal gönderi veya Hikâye tıklama davranışını yanlışlıkla tetiklemez.
3. Fotoğraf kırpılmadan tam ekran görüntüleyicide açılır.
4. Tekerlek yakınlaştırması `1×–10×` arasında akıcıdır ve imlecin altındaki görüntü noktası yerini korur.
5. Büyütülmüş fotoğraf sürüklenebilir fakat tamamen ekran dışına çıkarılamaz.
6. Karusel fotoğrafları düğmeler ve klavye oklarıyla gezilebilir.
7. Fotoğraf değiştiğinde yakınlaştırma ve konum sıfırlanır.
8. Fotoğraf Hikâyesi görüntüleyici açıkken durur ve kapandığında doğru önceki durumuna döner.
9. Görüntüleyici klavye ve ekran okuyucu için kullanılabilirdir.
10. Dinamik Instagram sayfa geçişleri yinelenen düğme, takılı kaydırma kilidi veya takılı Hikâye durumu bırakmaz.
11. Mevcut video kontrolleri ve testleri çalışmaya devam eder.
