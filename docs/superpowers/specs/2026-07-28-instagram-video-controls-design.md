# Instagram Video Kontrolleri Eklentisi — Tasarım

## Amaç

Instagram web arayüzündeki gönderi, Reels ve Hikâye videolarına tutarlı, modern ve kullanışlı bir kontrol çubuğu ekleyen bir Chrome eklentisi oluşturmak.

İlk sürüm yalnızca `instagram.com` üzerinde çalışacak. Harici sunucuya bağlanmayacak, analitik kullanmayacak ve kullanıcı verisi toplamayacak.

## Kapsam

Kontrol çubuğu şu işlevleri sağlar:

- Oynat / duraklat
- Sürüklenebilir zaman çizgisiyle ileri veya geri sarma
- Geçen süre ve toplam süre gösterimi
- Ses seviyesi ayarı
- Sessize alma / sesi açma
- `0.5x`, `0.75x`, `1x`, `1.25x`, `1.5x` ve `2x` oynatma hızı
- Tam ekrana girme ve tam ekrandan çıkma

Klavye kısayolları, resim içinde resim, indirme ve Instagram dışındaki siteler ilk sürümün kapsamı dışındadır.

## Kullanıcı Deneyimi

Kontrol çubuğu videonun alt bölümünde yarı saydam, koyu renkli ve yuvarlatılmış bir yüzey olarak görünür. Video veya kontrol alanı üzerinde fare hareket ettiğinde açılır; kullanıcı etkileşimi yoksa kısa bir gecikmeyle gizlenir.

Kullanıcı zaman çizgisini, ses ayarını veya hız menüsünü kullanırken çubuk gizlenmez. Dokunmatik veya tıklama temelli kullanımda videoya ya da kontrol alanına dokunmak çubuğu görünür tutar.

Dar Hikâye ve Reels görünümlerinde zaman çizgisi üst satırı, düğmeler alt satırı kullanabilir. Yeterli genişlik varsa bütün kontroller tek satırda yer alır.

Eklenti Instagram'ın kendi tıklama davranışlarını yalnızca kontrol çubuğunun sınırları içinde engeller. Çubuğun dışındaki beğenme, yorum, Hikâye ilerletme ve benzeri davranışlar değişmez.

## Mimari

Eklenti Chrome Manifest V3 biçimindedir ve yalnızca `https://www.instagram.com/*` için çalışan bir içerik betiği kullanır. Arka plan servisi veya uzak kod bulunmaz.

İçerik betiği üç sorumluluğa ayrılır:

1. **Video keşfi:** İlk yüklemede mevcut `video` öğelerini bulur. Instagram tek sayfa uygulaması olduğundan, sonradan eklenen videoları bir `MutationObserver` ile izler.
2. **Video denetleyicisi:** Her video için medya olaylarını dinler ve oynatma, süre, ses, hız ve tam ekran işlemlerini yürütür.
3. **Kontrol görünümü:** Instagram stillerinden etkilenmemek için Shadow DOM içinde oluşturulur. Görünüm, denetleyiciden aldığı durumla güncellenir.

İşlenmiş videolar bir `WeakMap` ile takip edilir. Böylece aynı videoya ikinci kontrol çubuğu eklenmez ve DOM'dan kaldırılan videolar çöp toplama mekanizması tarafından serbest bırakılabilir.

## Yerleşim ve Kapsayıcı Seçimi

Her video için, videoyu tam olarak örten en yakın uygun konumlandırma kapsayıcısı bulunur. Eklenti bu kapsayıcıya tek bir ana öğe ekler ve kontrol çubuğunu videonun alt kenarına hizalar.

Kapsayıcının mevcut `position` değeri `static` ise yalnızca eklenti aktifken `relative` yapılır. Eklentinin eklediği sınıf ve öğeler benzersiz bir ad alanı kullanır.

Tam ekran isteğinde önce seçilen kapsayıcı kullanılır. Kapsayıcı tam ekran API'sini kabul etmezse doğrudan video öğesi denenir. Tam ekran API'si desteklenmiyorsa kontrol devre dışı görünür.

## Durum ve Olay Akışı

Video olayları arayüzün tek doğruluk kaynağıdır:

- `play` ve `pause`, oynat düğmesini günceller.
- `timeupdate`, geçen süreyi ve zaman çizgisini günceller.
- `durationchange` ve `loadedmetadata`, toplam süreyi günceller.
- `volumechange`, ses ve sessiz durumunu günceller.
- `ratechange`, hız seçimini günceller.
- `ended`, son karede duraklatılmış görünümü gösterir.
- `fullscreenchange`, tam ekran düğmesinin durumunu günceller.

Zaman çizgisi sürüklenirken videodan gelen `timeupdate` olayları kullanıcının tuttuğu değeri ezmez. Sürükleme tamamlandığında `currentTime` güncellenir.

Süre bilinmiyorsa veya sonlu değilse zaman çizgisi devre dışı kalır ve toplam süre `--:--` gösterilir.

## Hikâye ve Dinamik Sayfa Davranışı

Hikâyeler ve Reels geçiş sırasında video öğelerini sık sık değiştirir. Gözlemci yalnızca eklenen alt ağaçlarda video arar; tüm belgeyi her değişiklikte yeniden taramaz.

Kontrol çubuğundaki `pointerdown`, `click` ve gerekli klavye olayları üst öğelere yayılmaz. Böylece zaman çizgisi veya ses kontrolüne tıklamak Hikâye'nin istemeden sonraki karta geçmesine neden olmaz.

Instagram rotası değiştiğinde içerik betiği çalışmaya devam eder ve yeni videoları otomatik olarak işler.

## Hata Yönetimi

- Tarayıcının otomatik oynatma kısıtlaması nedeniyle `video.play()` reddedilirse arayüz duraklatılmış durumda kalır.
- Tam ekran isteği reddedilirse sayfa çalışmayı sürdürür; düğme kısa süreli hata durumuna geçebilir.
- Bir video veya kapsayıcı işlem sırasında DOM'dan kaldırılırsa denetleyici olay dinleyicilerini bırakır ve işlem sessizce sonlanır.
- Tek bir videodaki hata diğer videoların kurulmasını engellemez.

## Güvenlik ve Gizlilik

- Erişim alanı yalnızca Instagram'dır.
- `eval`, uzak betik, harici ağ isteği ve kullanıcı izleme yoktur.
- Eklenti Instagram oturum bilgilerine, mesajlara veya metin içeriğine erişmez.
- İlk sürümde kalıcı ayar tutulmadığı için `storage` izni istenmez.

## Test Stratejisi

Saf medya yardımcıları ve denetleyici davranışları Node'un yerleşik test çalıştırıcısıyla test edilir. Testler en az şu durumları kapsar:

- Süre biçimlendirme
- Geçersiz veya bilinmeyen süre
- Zaman çizgisi değerinin `currentTime` değerine dönüşmesi
- Oynatma hızı seçeneklerinin uygulanması
- Aynı videonun iki kez işlenmemesi
- Sonradan eklenen videonun keşfedilmesi
- Kullanıcı sürüklerken `timeupdate` olayının çizgiyi ezmemesi

Manuel doğrulama kontrol listesi:

- Normal gönderi videosunda bütün kontroller
- Reels görünümünde bütün kontroller
- Hikâyede bütün kontroller ve yanlışlıkla ileri geçmeme
- Sayfa içi gezinmeden sonra yeni videoların algılanması
- Birden fazla videonun bulunduğu akışta doğru videonun kontrol edilmesi
- Tam ekrana girme ve çıkma
- Kontrol çubuğunun Instagram'ın diğer düğmelerini kapatmaması

## Teslimat

Teslimat, Chrome'un “Paketlenmemiş öğe yükle” seçeneğiyle doğrudan yüklenebilen bir klasör ve kısa Türkçe kurulum belgesi içerir.

