# Instagram Video Controls Uzantı İkonu Tasarımı

## Amaç

Chrome Uzantılar sayfasında, araç çubuğunda ve uzantı yönetim yüzeylerinde
Instagram Video Controls’ü ayırt edilebilir, modern ve küçük boyutlarda okunaklı
bir ikonla temsil etmek.

## Görsel Yön

- İkon, şeffaf dış alana sahip yuvarlatılmış kare biçiminde olacaktır.
- Zemin koyu lacivertten buz mavisine hafif bir geçiş kullanacaktır.
- Merkezde kalın, yüksek kontrastlı beyaz bir oynat üçgeni bulunacaktır.
- Sağ alt köşede video ve fotoğraf özelliklerini birlikte anlatan küçük bir
  büyüteç işareti yer alacaktır.
- Instagram logosu, Instagram’ın kamera işareti veya marka renk geçişinin birebir
  kopyası kullanılmayacaktır.
- Renk dili uzantının mevcut buz mavisi `#60a5fa` vurgusuyla uyumlu olacaktır.

## Boyutlar

Şu kare PNG dosyaları üretilecektir:

- `icons/icon16.png`
- `icons/icon32.png`
- `icons/icon48.png`
- `icons/icon128.png`

`128px` ana tasarım gölge, ince parlak kenar ve hafif derinlik içerebilir.
`48px` sürümü aynı biçimi daha az ayrıntıyla koruyacaktır. `32px` ve özellikle
`16px` sürümlerinde küçük ayrıntılar sadeleştirilerek oynat üçgeni ve büyüteç
okunabilir tutulacaktır. Her dosyanın piksel ölçüsü dosya adındaki ölçüyle tam
eşleşecektir.

## Manifest Entegrasyonu

`manifest.json` içinde:

- Üst düzey `icons` alanı dört PNG boyutunu tanımlayacaktır.
- `action.default_icon` aynı dört dosyayı kullanacaktır.
- Boş bir `action` tanımı araç çubuğu ikonunun görünmesini sağlayacak, tıklama
  davranışı veya açılır pencere eklenmeyecektir.
- Yeni izin, arka plan betiği veya dış bağımlılık eklenmeyecektir.

## Doğrulama

- Dört dosyanın varlığı ve tam piksel ölçüleri otomatik kontrol edilecektir.
- PNG dosyalarının saydamlık kanalı ve geçerli görüntü yapısı doğrulanacaktır.
- `manifest.json` ayrıştırılacak; tüm ikon yollarının mevcut dosyalara işaret
  ettiği kontrol edilecektir.
- Chrome Uzantılar sayfasında `128px/48px` görünümü ve araç çubuğunda küçük ikon
  görünümü manuel olarak kontrol edilecektir.

## Kabul Kriterleri

1. Chrome’un varsayılan harf kutusu yerine özel ikon görünür.
2. Oynat simgesi ve büyüteç, `16px` dâhil tüm boyutlarda ayırt edilebilir.
3. İkon mevcut buz mavisi arayüzle görsel olarak uyumludur.
4. Görsel Instagram’ın resmi logosunu taklit etmez.
5. Manifest yeni izin veya işlevsel davranış eklemez.
