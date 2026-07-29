# Instagram Video Controls

Instagram Video Controls; Instagram gönderileri, Reels ve Hikâyelerdeki videolara
modern bir kontrol katmanı, içerik fotoğraflarına ise tam ekran büyütme ve akıcı
yakınlaştırma ekleyen paketlenmemiş bir Chrome uzantısıdır.

## Kurulum

1. Chrome’da `chrome://extensions` adresini açın.
2. Sağ üstteki **Geliştirici modu** anahtarını etkinleştirin.
3. **Paketlenmemiş öğe yükle** seçeneğine tıklayın.
4. `C:\Users\USER\Desktop\projeler\instagram-video-controls` klasörünü seçin.
5. Açık Instagram sekmelerini yenileyin.

Uzantı yalnızca `https://www.instagram.com/*` adreslerinde çalışır. Ek izin veya
`host_permissions` istemez, uzak bir sunucuya veri göndermez ve hesap bilgilerini
depolamaz.

## Video kontrolleri

Şu video yüzeyleri desteklenir:

- Akış ve gönderi videoları
- Reels videoları
- Hikâye videoları

Kontrol çubuğu oynatma/duraklatma, ileri-geri sarma, süre, ses, sessize alma,
oynatma hızı ve tam ekran işlevlerini içerir. Instagram’ın kendi ses durumu ile
senkron çalışır ve uygulama içi gezinmelerde yeni videoları otomatik algılar.

## Fotoğraf büyütme

Şu fotoğraf yüzeyleri desteklenir:

- Tek fotoğraflı gönderiler
- Fotoğraf içeren çoklu gönderiler
- Fotoğraf Hikâyeleri

Uygun fotoğrafın sağ üstünde görünen büyüteç düğmesi tam ekran görüntüleyiciyi
açar. Profil fotoğrafları, avatarlar, profil ızgarası küçük resimleri, simgeler ve
videolar büyüteç almaz.

Görüntüleyicide:

- Fare tekerleğiyle `1×–10×` arasında akıcı yakınlaştırma yapılır.
- Yakınlaştırma, imlecin altındaki görüntü noktasını sabit tutar.
- Büyütülmüş fotoğraf fareyle sürüklenebilir.
- Çoklu gönderiler sağ-sol düğmeleri veya klavye oklarıyla gezilebilir.
- Fotoğraf Hikâyesi görüntüleyici açıkken durur, kapanınca önceki durumuna döner.

Klavye kısayolları:

- `Esc`: kapat
- `←` / `→`: önceki veya sonraki fotoğraf
- `+` / `-`: yakınlaştır veya uzaklaştır
- `0`: görünümü sıfırla

## Güncelleme veya yeniden yükleme

Dosyalarda değişiklik yaptıktan sonra `chrome://extensions` sayfasındaki uzantı
kartında yenile düğmesine basın. Ardından açık Instagram sekmesini yenileyin.
Klasörün yeri değiştiyse uzantıyı kaldırıp **Paketlenmemiş öğe yükle** ile yeni
klasörü seçin.

Instagram’ın sayfa yapısı zaman zaman değişebilir. Böyle bir değişiklik
kontrollerin veya büyütecin görünmesini etkilerse uzantının güncellenmesi
gerekebilir.

## Doğrulama

Otomatik testleri çalıştırmak için:

```powershell
npm.cmd test
```

Yayın öncesinde `docs/manual-test-checklist.md` dosyasındaki maddeleri gerçek bir
Instagram oturumunda doğrulayın.
