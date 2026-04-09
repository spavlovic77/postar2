# Zásady ochrany osobných údajov služby peppolbox.sk

**Platné od:** [DOPLNIŤ DÁTUM]
**Verzia:** 1.0

---

## 1. Úvod a identifikácia prevádzkovateľa

1.1. Tento dokument popisuje, ako spoločnosť **elektronickapodatelna s.r.o.** (ďalej len **„Prevádzkovateľ"** alebo **„my"**) spracúva osobné údaje v súvislosti s prevádzkou služby **peppolbox.sk** (ďalej len **„Služba"**).

1.2. **Prevádzkovateľom** je:

> **elektronickapodatelna s.r.o.**
> Sídlo: Dolná horná 12, Horná Mariková
> IČO: [DOPLNIŤ]
> DIČ: 1234567890
> IČ DPH: [DOPLNIŤ]
> Kontaktný e-mail: info@elektronickapodatelna.sk
> Kontakt pre ochranu osobných údajov: **dpo@elektronickapodatelna.sk**

1.3. Spracúvanie osobných údajov prebieha v súlade s nariadením Európskeho parlamentu a Rady (EÚ) 2016/679 o ochrane fyzických osôb pri spracúvaní osobných údajov (**GDPR**) a so zákonom č. 18/2018 Z. z. o ochrane osobných údajov.

---

## 2. Roly a vzťahy pri spracúvaní

2.1. V kontexte Služby pôsobíme v dvoch rôznych roliach:

**A) Ako prevádzkovateľ (data controller)** vo vzťahu k:
- údajom našich vlastných používateľov a zákazníkov, ktoré sú nevyhnutné na poskytovanie a fakturáciu Služby.

**B) Ako sprostredkovateľ (data processor)** vo vzťahu k:
- osobným údajom obsiahnutým v elektronických faktúrach a iných obchodných dokumentoch, ktoré sa cez Službu prijímajú v mene zákazníka.

V rámci tejto úlohy sa na nás vzťahuje samostatná **Zmluva o spracúvaní osobných údajov (DPA)**, ktorá je súčasťou zmluvného vzťahu so zákazníkom.

2.2. Tento dokument popisuje predovšetkým prvú rolu (prevádzkovateľa).

---

## 3. Aké údaje spracúvame

### 3.1. Údaje o používateľoch (fyzických osobách)

| Kategória | Príklad údajov | Účel spracúvania |
|---|---|---|
| Identifikačné údaje | meno, priezvisko | Identifikácia v rámci Služby |
| Kontaktné údaje | e-mail, telefónne číslo | Prihlasovanie, doručovanie notifikácií, jednorazové overovacie kódy (OTP) |
| Účtové údaje | identifikátor v systéme, rola, prepojené spoločnosti | Riadenie prístupových oprávnení |
| Údaje o aktivite | história prihlásení, IP adresa, typ prehliadača (user-agent) | Bezpečnosť, audit, prevencia zneužitia |
| Súhlas s dokumentmi | verzia VOP a Zásad, dátum, IP | Preukázanie udelenia súhlasu |

### 3.2. Údaje o zákazníkoch (právnických osobách)

| Kategória | Príklad údajov | Účel spracúvania |
|---|---|---|
| Identifikácia spoločnosti | obchodné meno, IČO, DIČ, IČ DPH, sídlo, DIČ | Fakturácia, registrácia na sieti Peppol |
| Kontakt | e-mail spoločnosti, telefón | Notifikácie o prijatých dokumentoch |
| Údaje o platbách | história dobití, zostatok peňaženky, transakcie | Účtovníctvo, daňové povinnosti |

### 3.3. Údaje obsiahnuté v dokumentoch (faktúrach)

V prijatých faktúrach a dobropisoch sa môžu nachádzať osobné údaje fyzických osôb (napr. meno kontaktnej osoby na strane dodávateľa). Tieto údaje spracúvame v role **sprostredkovateľa** v mene zákazníka. Účelom je výlučne sprístupnenie dokumentov zákazníkovi a doručenie notifikácií.

---

## 4. Právne základy spracúvania

| Účel | Právny základ podľa GDPR |
|---|---|
| Poskytovanie a fakturácia Služby | čl. 6 ods. 1 písm. b) – plnenie zmluvy |
| Registrácia a riadenie účtu | čl. 6 ods. 1 písm. b) – plnenie zmluvy |
| Vystavovanie faktúr a daňové povinnosti | čl. 6 ods. 1 písm. c) – plnenie zákonných povinností (zákon o DPH, zákon o účtovníctve) |
| Bezpečnosť a auditné záznamy | čl. 6 ods. 1 písm. f) – oprávnený záujem (ochrana Služby pred zneužitím) |
| Riešenie sporov a vymáhanie pohľadávok | čl. 6 ods. 1 písm. f) – oprávnený záujem |
| Webová analytika (Vercel Analytics) | čl. 6 ods. 1 písm. f) – oprávnený záujem (zlepšovanie Služby) na základe agregovaných údajov bez identifikácie jednotlivca |

---

## 5. Doba uchovávania údajov

| Kategória údajov | Doba uchovávania |
|---|---|
| **Účet a profil používateľa** | Po dobu existencie účtu. Po deaktivácii: **24 mesiacov nečinnosti** → upozornenie e-mailom → 30 dní → vymazanie (ak nie je inak dohodnuté). |
| **Prijaté dokumenty (faktúry, dobropisy)** | **Po dobu trvania zmluvného vzťahu.** Služba nevykonáva dlhodobú archiváciu – zákazník je povinný stiahnuť a archivovať dokumenty pre svoje účtovné a daňové účely. Po deaktivácii účtu sa dokumenty mažú spolu s účtom. |
| **Auditné záznamy** | **3 roky** od dátumu udalosti. Po uplynutí lehoty sú archivované do offline úložiska alebo zmazané. |
| **Záznamy o platbách a faktúry vystavené Prevádzkovateľom** | **10 rokov** v zmysle zákona č. 431/2002 Z. z. o účtovníctve. |
| **Verifikačné kódy (OTP)** | **5 minút** od vygenerovania. |
| **QR platobné odkazy** | 24 hodín do expirácie + **90 dní** história. |
| **Kontaktné e-maily a podporné požiadavky** | **3 roky** od ukončenia komunikácie. |

---

## 6. Príjemcovia a sprostredkovatelia

Pri prevádzke Služby využívame nasledujúcich poskytovateľov („sub-processors"), ktorí spracúvajú osobné údaje v našom mene:

### 6.1. Infraštruktúra a hosting

| Sprostredkovateľ | Účel | Krajina spracúvania | Záruky prenosu |
|---|---|---|---|
| **Supabase** | Databáza, autentifikácia, úložisko | EÚ (Frankfurt) | Spracúvanie v rámci EÚ |
| **Vercel** | Hosting webovej aplikácie, Analytics | EÚ (Frankfurt) | Spracúvanie v rámci EÚ |

### 6.2. Komunikácia

| Sprostredkovateľ | Účel | Krajina spracúvania | Záruky prenosu |
|---|---|---|---|
| **Resend** | Odosielanie transakčných e-mailov | USA | Štandardné zmluvné doložky (SCC) podľa GDPR |
| **Twilio** | Odosielanie SMS s overovacími kódmi | USA | Štandardné zmluvné doložky (SCC) podľa GDPR |

### 6.3. Sieť Peppol

| Sprostredkovateľ | Účel | Krajina spracúvania |
|---|---|---|
| **ion-AP** (Peppol Access Point) | Prijímanie elektronických faktúr cez sieť Peppol | EÚ |

### 6.4. Platobný systém

| Systém | Účel | Charakter |
|---|---|---|
| **NOP – Notifikátor okamžitých platieb** (Finančná správa SR) | Generovanie QR platieb a potvrdzovanie prijatia platieb | Štátny systém Slovenskej republiky – nie je sprostredkovateľom v zmysle GDPR, ale autoritou prevádzkujúcou platobný štandard |

### 6.5. Zmena sprostredkovateľov

Vyhradzujeme si právo zmeniť alebo doplniť sprostredkovateľov. O takejto zmene budú zákazníci informovaní e-mailom alebo prostredníctvom aktualizácie tohto dokumentu najmenej **30 dní vopred**.

---

## 7. Prenosy do tretích krajín

Niektorí naši sprostredkovatelia (Resend, Twilio) sídlia v USA. Pre tieto prenosy uplatňujeme **štandardné zmluvné doložky (SCC)** schválené Európskou komisiou v rozhodnutí 2021/914 ako záruku zodpovedajúcej úrovne ochrany osobných údajov.

Žiadne osobné údaje neprenášame do krajín, ktoré nemajú zodpovedajúcu úroveň ochrany alebo s ktorými nemáme uzavreté SCC.

---

## 8. Práva dotknutých osôb

V súlade s GDPR máte ako dotknutá osoba nasledujúce práva:

| Právo | Popis |
|---|---|
| **Právo na prístup** (čl. 15) | Získať potvrdenie, či spracúvame vaše údaje, a ich kópiu. |
| **Právo na opravu** (čl. 16) | Žiadať opravu nesprávnych alebo doplnenie neúplných údajov. |
| **Právo na vymazanie** („právo byť zabudnutý", čl. 17) | Žiadať vymazanie údajov, ak už nie sú potrebné na účel spracúvania. |
| **Právo na obmedzenie spracúvania** (čl. 18) | Žiadať dočasné obmedzenie spracúvania. |
| **Právo na prenosnosť** (čl. 20) | Získať svoje údaje v štruktúrovanom strojovo čitateľnom formáte. |
| **Právo namietať** (čl. 21) | Namietať spracúvanie založené na oprávnenom záujme. |
| **Právo podať sťažnosť** | Podať sťažnosť dozornému orgánu – **Úrad na ochranu osobných údajov SR**, Hraničná 12, 820 07 Bratislava 27 (www.dataprotection.gov.sk). |

### 8.1. Ako uplatniť svoje práva

Žiadosti smerujte na: **dpo@elektronickapodatelna.sk**

Žiadosť spracujeme do **30 dní** od jej doručenia. V odôvodnených prípadoch (zložitosť, počet požiadaviek) môžeme túto lehotu predĺžiť o ďalšie 60 dní, o čom vás budeme informovať.

### 8.2. Vymazanie účtu

Vymazanie účtu je možné z užívateľského rozhrania v sekcii **Nastavenia → Vymazať účet** alebo žiadosťou na dpo@elektronickapodatelna.sk. Vymazanie účtu zahŕňa:
- vymazanie profilu používateľa,
- zrušenie všetkých členstiev v spoločnostiach,
- vymazanie prijatých dokumentov spojených s deaktivovanými spoločnosťami (po vyúčtovaní zostatku peňaženky).

**Niektoré údaje môžu byť aj po vymazaní účtu uchované** v rozsahu nevyhnutnom pre splnenie zákonných povinností, najmä:
- účtovné záznamy a faktúry vystavené zákazníkovi (10 rokov),
- auditné záznamy o bezpečnostných udalostiach (3 roky).

### 8.3. Export údajov

Na žiadosť poskytneme všetky vaše údaje v strojovo čitateľnom formáte (JSON alebo CSV) do 30 dní.

---

## 9. Bezpečnosť údajov

9.1. Pri spracúvaní osobných údajov uplatňujeme primerané technické a organizačné opatrenia, najmä:

- a) šifrované spojenia (HTTPS, TLS) pre všetku komunikáciu;
- b) šifrované úložisko hesiel a citlivých údajov;
- c) viacstupňové oprávnenia (rola super-admin, company admin, operátor, processor);
- d) auditné záznamy všetkých dôležitých operácií;
- e) izolácia účtov jednotlivých zákazníkov na úrovni databázy;
- f) pravidelné aktualizácie softvérových komponentov;
- g) zabezpečenie fyzických serverov v dátových centrách s certifikáciou ISO 27001 (Frankfurt).

9.2. **Bezpečnostný incident.** V prípade porušenia ochrany osobných údajov vás budeme informovať bez zbytočného odkladu, ak je pravdepodobné, že incident má za následok vysoké riziko pre vaše práva a slobody. Dozorný orgán informujeme do 72 hodín od zistenia incidentu.

---

## 10. Cookies a sledovacie technológie

10.1. Služba používa nasledujúce typy súborov cookies a podobných technológií:

| Typ | Účel | Súhlas potrebný? |
|---|---|---|
| **Funkčné cookies** | Udržanie prihlásenej relácie, jazykové nastavenia, téma (svetlá/tmavá) | Nie – sú nevyhnutné na fungovanie Služby |
| **Analytické cookies** (Vercel Analytics) | Agregovaná štatistika návštevnosti, optimalizácia výkonu | Áno – súhlas sa získava cez cookie banner |

10.2. Vercel Analytics nezhromažďuje IP adresy v identifikovateľnej forme a nepoužíva cookies tretích strán na sledovanie naprieč webmi. Údaje sú agregované a anonymizované.

10.3. Súhlas s analytickými cookies môžete kedykoľvek odvolať v nastaveniach prehliadača alebo prostredníctvom cookie bannera.

---

## 11. Automatizované rozhodovanie a profilovanie

Služba **nevykonáva automatizované rozhodovanie ani profilovanie** v zmysle čl. 22 GDPR, ktoré by malo právne účinky alebo obdobne významný vplyv na používateľa.

---

## 12. Zmena Zásad ochrany osobných údajov

12.1. Tento dokument môžeme z času na čas aktualizovať. O každej podstatnej zmene budeme informovať e-mailom najmenej **30 dní vopred**.

12.2. Aktuálna verzia je vždy dostupná na: **https://www.peppolbox.sk/legal/ochrana-udajov**

12.3. História verzií:

| Verzia | Dátum | Zmeny |
|---|---|---|
| 1.0 | [DOPLNIŤ] | Prvá verzia |

---

## 13. Kontakt

Akékoľvek otázky týkajúce sa spracúvania osobných údajov smerujte na:

> **dpo@elektronickapodatelna.sk**
>
> **elektronickapodatelna s.r.o.**
> Dolná horná 12, Horná Mariková

---

**elektronickapodatelna s.r.o.**
Verzia 1.0
Účinnosť od: [DOPLNIŤ DÁTUM]
