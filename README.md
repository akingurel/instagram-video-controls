# Instagram Video Controls

Instagram Video Controls, Instagram'daki gönderi, Reel ve Hikâye videolarına
tarayıcıya ait kontrollerden bağımsız bir kontrol katmanı ekleyen paketlenmemiş
bir Chrome uzantısıdır. Kontroller oynatma/duraklatma, ileri-geri sarma, süre,
ses, sessize alma, hız ve tam ekran işlevlerini kapsar.

## Kurulum

1. Chrome'da `chrome://extensions` adresini açın.
2. Sayfanın sağ üstündeki **Geliştirici modu** anahtarını etkinleştirin.
3. **Paketlenmemiş öğe yükle** seçeneğine tıklayın.
4. Açılan dosya seçicisinde `C:\Users\USER\Desktop\projeler\instagram-video-controls`
   klasörünü seçin.
5. Instagram zaten açık bir sekmedeyse sekmeyi yenileyin.

Uzantı yalnızca `https://www.instagram.com/*` adreslerinde çalışır. Manifest,
ek izin veya `host_permissions` istemez; uzantı uzak bir sunucuya veri göndermez,
hesap bilgilerinizi toplamaz ve depolama alanı kullanmaz.

## Kullanım kapsamı

Desteklenen video türleri şunlardır:

- Akış ve gönderi videoları
- Reels videoları
- Hikâye videoları

Her video kendi kontrolünü yönetir. Kontroller, video üzerinde bir katman olarak
görünür; etkileşim sırasında görünür kalır ve klavyeyle odaklanılabilir. Instagram
sayfası içindeki gezinmeler için uzantı videoları yeniden algılar; sekmeyi yeniden
yüklemek gerekmez.

## Güncelleme veya yeniden yükleme

Dosyalarda değişiklik yaptıktan sonra `chrome://extensions` sayfasına dönün ve
uzantı kartındaki yenile simgesine tıklayın. Ardından açık Instagram sekmesini
yenileyin. Klasörün yerini değiştirdiyseniz uzantıyı kaldırıp **Paketlenmemiş öğe
yükle** ile yeni klasörü seçin.

Instagram'ın sayfa yapısı (DOM) zaman zaman değişebilir. Böyle bir değişiklik
kontrollerin görünmesini veya doğru hizalanmasını etkilerse uzantının güncellenmesi
gerekebilir.

## Yayına hazırlık

Otomatik kontrollerden sonra `docs/manual-test-checklist.md` dosyasındaki her
maddeyi Chrome'da uzantıyı yükleyerek doğrulayın. Kontrol edilmemiş kutular,
henüz manuel olarak doğrulanmamış davranışları gösterir.
