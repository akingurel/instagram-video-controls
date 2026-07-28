# Kompakt Instagram Video Kontrolleri Tasarımı

## Amaç

Instagram gönderileri, Reels ve Hikâyeler üzerindeki kontrol çubuğunu daha az yer kaplayan, daha şeffaf ve okunaklı bir yapıya dönüştürmek. Boş görünen simgeleri düzeltmek ve dikey videoların tam ekranda üstten veya alttan taşmasını engellemek.

## Arayüz

- Panel, videonun alt kenarında kalır ve kullanılmadığında mevcut otomatik gizlenme davranışını korur.
- İlerleme sürgüsü panelin üst sırasında, tam genişlikte ve yaklaşık 4 piksel yüksekliğinde görünür.
- Alt sıra; oynat/duraklat, zaman, ses, hız ve tam ekran kontrollerinden oluşur.
- Butonların etkileşim alanı 28–30 piksel olur. Büyük, dolu kutu görünümü kaldırılır; hover ve klavye odağında hafif bir arka plan kullanılır.
- Panel 6 piksel iç boşluk ve küçük bir dış boşluk kullanır. Arka plan yaklaşık `%45` koyulukta, ince kenarlıklı ve hafif bulanık cam görünümünde olur.
- Dar Hikâye/Reels alanlarında panel iki ince sırayı korur; kontroller ikinci bir büyük blok oluşturmaz.

## Simgeler

- Oynat, duraklat, ses, sessiz ve tam ekran simgeleri `createElementNS` ile gerçek SVG elemanları olarak oluşturulur.
- Simgeler 16–18 piksel boyutunda, beyaz ve düğme durumuyla uyumlu olur.
- Mevcut erişilebilir adlar ve durum değişimleri korunur.

## Ses Kontrolü

- Ses sürgüsü normal durumda gizlidir.
- Ses düğmesinin üzerine gelindiğinde veya düğme klavye/dokunma odağı aldığında yatay bir açılır sürgü görünür.
- Ses düğmesine tıklama, mevcut sessize alma/açma davranışını korur.
- Açılan sürgü panelin yüksekliğini artırmaz ve diğer kontrolleri kaydırmaz.

## Tam Ekran

- Tam ekran isteği, kontrollerin görünür kalması için mevcut video kapsayıcısına uygulanır.
- Kapsayıcı tam ekrandayken genişlik ve yükseklik ekran sınırlarına sabitlenir, taşma gizlenir ve video merkezlenir.
- Video `object-fit: contain` ile en-boy oranını koruyarak ekran içine tamamen sığar; dikey videoların üstü veya altı kesilmez.
- Tam ekran açılırken değiştirilen kapsayıcı ve video inline stilleri kaydedilir.
- Tam ekrandan çıkıldığında bu stiller tam olarak geri yüklenir.
- Kontrol paneli alt güvenli alanda kalır.

## Bileşen Sınırları

- `control-view.js` yalnızca panel düzeni, SVG üretimi, ses açılır alanı ve görsel tam ekran sınıfını yönetir.
- `video-controller.js` tam ekran durumunu algılar ve video/kapsayıcı için geçici sığdırma stillerini uygular; çıkışta geri yükler.
- Mevcut intent sözleşmesi değişmez. Oynatma, süre, ses, hız ve tam ekran intent adları korunur.

## Hata ve Geri Yükleme

- Tam ekran isteği başarısız olursa mevcut hata bildirimi korunur ve geçici stiller uygulanmaz.
- Denetleyici yok edilirse açık tam ekran stilleri de geri yüklenir.
- Instagram DOM yapısı değişse bile stil değişiklikleri yalnızca denetlenen video ve seçilmiş kapsayıcıyla sınırlı kalır.

## Doğrulama

- Testler SVG elemanlarının doğru namespace ile üretildiğini doğrular.
- Stil testleri kompakt ölçüleri, yarı saydam arka planı ve açılır ses sürgüsünü doğrular.
- Tam ekran testleri sığdırma stillerinin uygulanmasını, ekran dışına taşmamasını ve çıkış/yok etme sırasında geri yüklenmesini doğrular.
- Mevcut süre sürükleme ve diğer kontrol testleri regresyon kontrolü olarak geçmeye devam eder.
- Canlı Instagram doğrulamasında dar bir Hikâye/Reels videosu ile panel yüksekliği, simgeler, ses sürgüsü, süre sürükleme ve tam ekran görünümü kontrol edilir.

## Kabul Kriterleri

1. Kontrol simgelerinin tamamı görünür ve birbirinden ayırt edilebilir.
2. Panel, mevcut tasarımın yaklaşık yarısı kadar dikey alan kullanır.
3. Panel arka planı videoyu belirgin biçimde gösterecek kadar şeffaftır.
4. Ses sürgüsü yalnızca ses alanıyla etkileşim sırasında görünür.
5. Dikey video tam ekranda bütünüyle görünür; üst ve alt içerik kesilmez.
6. Tam ekrandan çıkış Instagram’ın önceki yerleşimini bozmadan tamamlanır.
7. Süre sürgüsü ve tüm mevcut medya kontrolleri çalışmaya devam eder.
