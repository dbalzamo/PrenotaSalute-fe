# Documentazione progetto PrenotaSalute-FE

Documentazione di ogni classe dell’applicazione Angular: ruolo, utilizzo, metodi e momento in cui vengono invocati.

---

## Indice

1. [Bootstrap e root](#1-bootstrap-e-root)
2. [Configurazione e routing](#2-configurazione-e-routing)
3. [Core – Autenticazione](#3-core--autenticazione)
4. [Core – API services](#4-core--api-services)
5. [Core – WebSocket](#5-core--websocket)
6. [Layout](#6-layout)
7. [Pagine](#7-pagine)
8. [Modelli](#8-modelli)
9. [Ambienti](#9-ambienti)

---

## 1. Bootstrap e root

### `main.ts`

**Ruolo:** punto di ingresso dell’applicazione. Avvia l’app Angular e applica un polyfill per librerie che si aspettano `global` (es. sockjs-client).

**Utilizzo:** eseguito una sola volta al caricamento dell’app.

- **Polyfill `global`:** se `window.global` non esiste, lo imposta uguale a `window` per compatibilità con dipendenze tipo Node.
- **`bootstrapApplication(App, appConfig)`:** avvia il componente root `App` con la configurazione definita in `appConfig`. In caso di errore lo logga in console.

---

### `App` (`app/app.ts`)

**Ruolo:** componente root dell’applicazione. Contiene solo il `<router-outlet>` dove il router carica le route.

**Utilizzo:** istanziato da `bootstrapApplication`; il suo template viene renderizzato nel corpo della pagina.

- **Nessun metodo:** il componente non espone logica, solo il template con il router outlet.

---

## 2. Configurazione e routing

### `appConfig` (`app/app.config.ts`)

**Ruolo:** configurazione globale dell’applicazione (provider, router, HTTP, interceptors).

**Utilizzo:** passata a `bootstrapApplication` in `main.ts`; Angular la usa per registrare i provider e il router.

**Providers configurati:**

- **`provideBrowserGlobalErrorListeners()`** – listener globali per errori non gestiti.
- **`provideZoneChangeDetection({ eventCoalescing: true })`** – change detection con coalescing degli eventi.
- **`provideRouter(routes)`** – router con le route definite in `app.routes.ts`.
- **`provideHttpClient(withFetch(), withInterceptors([authInterceptor]))`** – client HTTP con fetch e interceptor che aggiunge il JWT.

---

### `routes` (`app/app.routes.ts`)

**Ruolo:** definizione delle route e dei guard che proteggono le pagine.

**Utilizzo:** letto dal router alla navigazione; i guard vengono eseguiti prima di attivare la route.

**Route:**

| Path             | Componente                    | Guard             | Descrizione                                      |
|------------------|--------------------------------|-------------------|--------------------------------------------------|
| `''`             | `LandingComponent`             | —                 | Redirect a dashboard o login                    |
| `login`          | `LoginComponent`               | `guestGuard`      | Solo utenti non loggati                          |
| `medico-curante` | `MedicoCuranteDashboardComponent` | `medicoCuranteGuard` | Solo medico curante                          |
| `paziente`      | `PazienteDashboardComponent`   | `pazienteGuard`   | Solo paziente                                   |
| `area-personale` | `AreaPersonaleComponent`      | `authGuard`       | Solo utenti autenticati                          |
| `messaggi`       | `MessaggiComponent`           | `authGuard`       | Solo utenti autenticati                          |

I componenti sono caricati in lazy loading con `loadComponent()`.

---

## 3. Core – Autenticazione

### `AuthService` (`core/auth/auth.service.ts`)

**Ruolo:** stato centrale dell’autenticazione: utente corrente, token, notifiche e conteggio messaggi non letti. Espone login, registrazione, logout e aggiornamento profilo.

**Utilizzo:** injectato nei componenti e nei guard che devono conoscere l’utente o eseguire login/logout.

**Stato esposto (signal/readonly):**

- **`currentUser`** – utente loggato (da sessionStorage all’avvio).
- **`notificationItems`** – elenco notifiche (richieste in attesa per il medico).
- **`isAuthenticated`** – computed che è `true` se c’è un utente.
- **`notificationsCount`** – numero notifiche (badge header).
- **`messagesUnreadCount`** – messaggi non letti (badge Posta).

**Metodi pubblici:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`login(username, password)`** | Chiama l’API login; in caso di successo salva token e user in signal e sessionStorage. | Da `LoginComponent` al submit del form di accesso. |
| **`register(signupRequest)`** | Chiama signup e poi login; aggiorna user e storage come in login. | Da `LoginComponent` al submit del form di registrazione. |
| **`updateProfile(partial)`** | Aggiorna lo stato locale dell’utente e il sessionStorage. | Da `AreaPersonaleComponent` dopo aver salvato il profilo (paziente/medico) o dopo aver caricato il profilo da API. |
| **`logout()`** | Chiama l’API logout, poi pulisce stato/token e reindirizza a `/login`. | Da header (pulsante “Esci”) e in caso di errore dalla stessa chiamata. |
| **`getToken()`** | Restituisce il JWT da sessionStorage. | Da `WebSocketMessageService` e da `MessaggiComponent` per la connessione WS; da `authInterceptor` (legge direttamente da storage). |
| **`getDashboardRoute()`** | Restituisce `/medico-curante` o `/paziente` in base al ruolo. | Da guard (`guestGuard`, `roleGuard`), da `LoginComponent` dopo login/register, da header per il link del logo. |
| **`setNotificationsCount(count)`** | Imposta il numero di notifiche. | Da `MedicoCuranteDashboardComponent` in caso di errore nel caricamento richieste (azzera il badge). |
| **`setNotifications(items)`** | Imposta l’elenco notifiche e il relativo conteggio. | Da `MedicoCuranteDashboardComponent` dopo aver caricato/aggiornato le richieste (solo quelle in stato INVIATA). |
| **`refreshMessagesUnreadCount()`** | Chiama l’API per il conteggio messaggi non letti e aggiorna `messagesUnreadCount`. | Da header in `ngOnInit` se autenticato; da `WebSocketMessageService` alla ricezione di un messaggio; da `MessaggiComponent` in init e dopo `markAsRead`. |

**Metodi privati (sintesi):** `loadFromStorage` / `saveToStorage` (persistenza utente), `mapRoleFromBackend` / `mapResponseToUser` (mappatura risposta API → `User`), `clearAndRedirect`, `setToken`, `clearToken`.

---

### `authGuard` (`core/auth/auth.guard.ts`)

**Ruolo:** guard che consente l’accesso solo agli utenti autenticati.

**Utilizzo:** usato nelle route `area-personale` e `messaggi` in `app.routes.ts`.

- **Comportamento:** se `auth.isAuthenticated()` è `true` restituisce `true`; altrimenti restituisce un `UrlTree` per `/login`.  
- **Invocazione:** dal router prima di attivare la route protetta.

---

### `guestGuard` (`core/auth/guest.guard.ts`)

**Ruolo:** guard che consente l’accesso solo agli utenti non autenticati (es. pagina login).

**Utilizzo:** usato nella route `login`.

- **Comportamento:** se l’utente non è autenticato restituisce `true`; altrimenti reindirizza alla dashboard con `auth.getDashboardRoute()`.  
- **Invocazione:** dal router prima di attivare la route `/login`.

---

### `roleGuard` / `medicoCuranteGuard` / `pazienteGuard` (`core/auth/role.guard.ts`)

**Ruolo:** factory che crea guard per ruolo. `medicoCuranteGuard` e `pazienteGuard` sono istanze per medico e paziente.

**Utilizzo:** `medicoCuranteGuard` su `medico-curante`, `pazienteGuard` su `paziente` in `app.routes.ts`.

- **`roleGuard(allowedRole)`:** restituisce una funzione guard che: se non c’è utente → redirect a `/login`; se il ruolo è diverso da `allowedRole` → redirect a `getDashboardRoute()`; altrimenti `true`.  
- **Invocazione:** dal router prima di attivare la route corrispondente.

---

### `authInterceptor` (`core/auth/auth.interceptor.ts`)

**Ruolo:** interceptor HTTP che aggiunge l’header `Authorization: Bearer <token>` a tutte le richieste verso l’API quando il token è presente in sessionStorage.

**Utilizzo:** registrato in `appConfig` con `withInterceptors([authInterceptor])`; Angular lo esegue per ogni richiesta HTTP.

- **Logica:** legge il token dalla stessa chiave usata da `AuthService`; se la richiesta è verso `environment.apiUrl` e il token è valido, clona la richiesta con l’header impostato; poi chiama `next(req)`.  
- **Invocazione:** automatica su ogni richiesta effettuata con `HttpClient`.

---

## 4. Core – API services

### `AuthApiService` (`core/api/auth-api.service.ts`)

**Ruolo:** chiamate HTTP verso gli endpoint di autenticazione (`/api/auth/...`). Non gestisce stato; restituisce Observable con risultato tipizzato.

**Utilizzo:** usato da `AuthService` per login, signup e logout; da `LoginComponent` per l’elenco medici in registrazione.

**Metodi:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`login(request)`** | POST login; ritorna `{ success, data }` o `{ success: false, error }`. | Da `AuthService.login()` e da `AuthService.register()` dopo signup. |
| **`signup(request)`** | POST signup; ritorna `{ success, message }` o `{ success: false, error }`. | Da `AuthService.register()`. |
| **`logout()`** | POST logout (con credenziali). | Da `AuthService.logout()`. |
| **`getMediciCuranti()`** | GET elenco medici per il select in registrazione (paziente). | Da `LoginComponent.ngOnInit()`. |

**Interfacce esportate:** `LoginRequest`, `LoginResponse`, `SignupRequest`. Metodo privato: `extractErrorMessage`.

---

### `MessageApiService` (`core/api/message-api.service.ts`)

**Ruolo:** API REST per messaggistica: conversazioni, conteggio non letti, segna come letti, medico associato al paziente, elenco pazienti/conversazioni per il medico, invio messaggio (fallback se WebSocket non disponibile).

**Utilizzo:** usato da `AuthService` (conteggio non letti), da `MessaggiComponent` per caricare conversazioni, medico, inviare e segnare come letti.

**Metodi:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`getConversation(userId1, userId2)`** | GET storico messaggi tra due account. | Da `MessaggiComponent` in `loadConversationAndConnect` e `loadConversationOnly`. |
| **`getUnreadCount(userId)`** | GET conteggio messaggi non letti. | Da `AuthService.refreshMessagesUnreadCount()`. |
| **`markAsRead(senderId, receiverId)`** | PUT segna come letti. | Da `MessaggiComponent.markAsReadFromOther()` quando si apre una conversazione. |
| **`getMioMedicoCurante()`** | GET medico curante del paziente (per Posta). | Da `MessaggiComponent.ngOnInit()` se ruolo paziente. |
| **`setMioMedicoCurante(medicoCuranteId)`** | PUT associa medico al paziente. | Non usato nell’attuale flusso (disponibile per futura UI). |
| **`getPazienti()`** | GET elenco pazienti del medico. | Non usato direttamente; le conversazioni passano da `getConversazioni()`. |
| **`getConversazioni()`** | GET anteprime conversazioni (ultimo messaggio, non letti). | Da `MessaggiComponent.ngOnInit()` se ruolo medico. |
| **`sendMessage(receiverId, content)`** | POST invio messaggio (fallback REST). | Da `MessaggiComponent.sendViaRest()` se WebSocket non disponibile o non connesso. |

**Interfacce esportate:** `MessageResponse`, `MessageDTO`, `MedicoCuranteResponse`, `PazientePerMessaggio`, `ConversazionePreview`.

---

### `MedicoApiService` (`core/api/medico-api.service.ts`)

**Ruolo:** API profilo del medico curante (GET `/api/medico/me`). Mappa la risposta nel formato `Partial<User>`.

**Utilizzo:** usato da `AreaPersonaleComponent` per caricare e mostrare i dati del medico loggato.

**Metodi:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`getProfilo()`** | GET profilo medico; ritorna `{ success, data: Partial<User> }` o `{ success: false, error }`. | Da `AreaPersonaleComponent.ngOnInit()` se `user.ruolo === 'Medico_Curante'`. |

**Metodi privati:** `mapToUserProfile`, `extractErrorMessage`. **Interfacce:** `MedicoProfiloResponse`.

---

### `PazienteApiService` (`core/api/paziente-api.service.ts`)

**Ruolo:** API profilo e aggiornamento del paziente (GET `/api/paziente/me`, PUT update). Mappa la risposta in `Partial<User>`.

**Utilizzo:** usato da `AreaPersonaleComponent` per caricare e salvare i dati del paziente loggato.

**Metodi:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`getProfilo()`** | GET profilo paziente. | Da `AreaPersonaleComponent.ngOnInit()` se `user.ruolo === 'Paziente'`. |
| **`updatePaziente(dto)`** | PUT aggiornamento dati paziente. | Da `AreaPersonaleComponent.saveProfile()` quando il ruolo è Paziente. |

**Interfacce:** `PazienteProfiloResponse`, `PazienteUpdateDto`.

---

### `RichiestaMedicaApiService` (`core/api/richiesta-medica-api.service.ts`)

**Ruolo:** API richieste mediche: elenco per paziente, elenco per medico, creazione, accetta, rifiuta. Mappa le risposte backend nei modelli frontend (`RichiestaPaziente`, `Richiesta`).

**Utilizzo:** usato da `PazienteDashboardComponent` e `MedicoCuranteDashboardComponent` per tutte le operazioni sulle richieste.

**Metodi:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`getMieRichieste()`** | GET richieste del paziente loggato. | Da `PazienteDashboardComponent.caricaRichieste()` (init e dopo creazione). |
| **`getRichiesteMedico()`** | GET richieste del medico loggato. | Da `MedicoCuranteDashboardComponent.caricaRichieste()` e dal polling ogni 5 secondi. |
| **`accettaRichiesta(idRichiesta)`** | PUT accetta richiesta. | Da `MedicoCuranteDashboardComponent.accetta()`. |
| **`rifiutaRichiesta(idRichiesta, motivazione)`** | POST rifiuto con motivazione. | Da `MedicoCuranteDashboardComponent.confermaRifiuto()`. |
| **`creaRichiesta(request)`** | POST nuova richiesta (paziente). | Da `PazienteDashboardComponent.inviaRichiestaMedica()`. |

**Tipi/interfacce esportati:** `TipoRichiesta`, `RichiestaMedicaRequest`, `RichiestaMedicaResponse`, `RichiestaMedicaMedicoResponse`. Metodi privati: mappature e `extractErrorMessage`. La priorità per il medico è al momento calcolata lato frontend (mock) in base all’id.

---

## 5. Core – WebSocket

### `WebSocketMessageService` (`core/websocket/websocket-message.service.ts`)

**Ruolo:** connessione WebSocket STOMP (SockJS) verso `/ws` per messaggistica in tempo reale. Espone uno stream di messaggi in arrivo e il metodo per inviare; gestisce JWT in query e sottoscrizione a `/user/queue/messages`.

**Utilizzo:** injectato in `HeaderComponent` (per aggiornare il badge messaggi) e in `MessaggiComponent` (per invio/ricezione messaggi).

**Metodi e proprietà:**

| Metodo/Proprietà | Descrizione | Quando viene invocato |
|-------------------|-------------|------------------------|
| **`onMessage`** (getter) | Observable dei messaggi ricevuti sul canale `/user/queue/messages`. | Sottoscritto in `HeaderComponent.ngOnInit()` e in `MessaggiComponent` (connect + subscribe). |
| **`connect(getToken)`** | Connessione al broker; sottoscrive a `/user/queue/messages`; alla ricezione emette su `onMessage` e chiama `auth.refreshMessagesUnreadCount()`. Se già connesso/in connessione restituisce la stessa Promise. | Da `HeaderComponent.ngOnInit()` (se autenticato); da `MessaggiComponent` in `loadConversationAndConnect` e `connectWebSocketForMedico`, e prima di `send` in `invia()`. |
| **`send(receiverId, content)`** | Pubblica su `/app/chat.send` (body JSON con receiverId e content). Non invia se non connesso. | Da `MessaggiComponent.invia()` quando il WebSocket è connesso. |
| **`isConnected`** (getter) | Indica se il client STOMP è connesso. | Da `MessaggiComponent.invia()` per decidere se usare WS o REST. |
| **`disconnect()`** | Chiude il client e azzera la promise di connessione. | Da `ngOnDestroy()` (servizio root, tipicamente alla chiusura dell’app). |

**Implementazione:** usa import dinamico di `@stomp/stompjs` e `sockjs-client`; l’URL WS include `?token=<JWT>`. Implementa `OnDestroy` per chiamare `disconnect()`.

---

## 6. Layout

### `HeaderComponent` (`layout/header/header.component.ts`)

**Ruolo:** barra superiore con logo, link Posta (con badge messaggi non letti), notifiche (badge e menu a tendina), menu profilo (Area personale, Esci). Avvia la connessione WebSocket e aggiorna il conteggio messaggi alla ricezione.

**Utilizzo:** incluso nei template delle pagine interne (area-personale, messaggi, dashboard medico, dashboard paziente) tramite il selettore `app-header`.

**Metodi e proprietà:**

| Metodo/Proprietà | Descrizione | Quando viene invocato |
|-------------------|-------------|------------------------|
| **`ngOnInit()`** | Se l’utente è autenticato: aggiorna il conteggio messaggi, connette il WebSocket, si sottoscrive a `onMessage` per richiamare `refreshMessagesUnreadCount`. | Da Angular al primo rendering del componente. |
| **`ngOnDestroy()`** | Fa unsubscribe dalla sottoscrizione a `onMessage`. | Da Angular alla distruzione del componente (cambio route). |
| **`toggleNotifications()`** | Apre/chiude il menu notifiche e chiude il menu profilo. | Click sul pulsante “Notifiche” nel template. |
| **`toggleProfileMenu()`** | Apre/chiude il menu profilo e chiude le notifiche. | Click sul pulsante profilo. |
| **`profileInitials`** (getter) | Iniziali dell’utente (nome+cognome) per l’avatar, fallback "DB". | Usato nel template dell’header. |

Il template usa `auth.currentUser()`, `auth.getDashboardRoute()`, `auth.notificationsCount()`, `auth.notificationItems()`, `auth.messagesUnreadCount()`, `auth.logout()`, e il `DatePipe` per le date nelle notifiche.

---

## 7. Pagine

### `LandingComponent` (`pages/landing/landing.component.ts`)

**Ruolo:** pagina radice (`path: ''`). Non mostra contenuto; in `ngOnInit` reindirizza alla dashboard se l’utente è autenticato, altrimenti a `/login`.

**Utilizzo:** caricato quando l’utente apre la root dell’app.

- **`ngOnInit()`:** legge `auth.isAuthenticated()` e `auth.getDashboardRoute()`, poi esegue `router.navigateByUrl(route)`.  
- **Invocazione:** una volta per visita alla route `''`.

---

### `LoginComponent` (`pages/login/login.component.ts`)

**Ruolo:** pagina di accesso e registrazione: form login, form registrazione (con ruolo, medico curante per pazienti, specializzazione per medici), toggle tra i due modi, submit e gestione errori.

**Utilizzo:** mostrato sulla route `login` (protetta da `guestGuard`).

**Stato (signal):** `isLoginMode`, `errorMessage`, `isLoading`, `mediciCuranti`.

**Metodi:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`ngOnInit()`** | Carica l’elenco medici curanti per il select registrazione. | Da Angular al primo rendering. |
| **`toggleMode()`** | Passa tra login e registrazione; resetta errori e form. | Click su “Registrati” / “Accedi” nel footer del form. |
| **`onSubmitLogin()`** | Valida il form, chiama `auth.login()`, in caso di successo naviga alla dashboard. | Submit del form di login. |
| **`onSubmitRegister()`** | Valida form e password/conferma, costruisce `SignupRequest`, chiama `auth.register()`, in caso di successo naviga alla dashboard. | Submit del form di registrazione. |
| **`passwordDimenticata()`** | Placeholder (TODO). | Click su “Password dimenticata?”. |
| **`haiBisognoAiuto()`** | Placeholder (TODO). | Click su “Hai bisogno di aiuto?”. |

---

### `AreaPersonaleComponent` (`pages/area-personale/area-personale.component.ts`)

**Ruolo:** pagina “Dati personali”: visualizzazione e modifica del profilo (paziente o medico). Carica il profilo da API in base al ruolo; per il paziente salva tramite PUT, per il medico aggiorna solo lo stato locale.

**Utilizzo:** route `area-personale`, protetta da `authGuard`.

**Stato (signal):** `isEditing`, `profileLoading`, `profileSaving`, `profileError`. **`user`** è il readonly di `auth.currentUser`. **`editForm`** contiene i campi in modifica.

**Metodi:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`ngOnInit()`** | In base al ruolo chiama `pazienteApi.getProfilo()` o `medicoApi.getProfilo()` e aggiorna lo stato con `auth.updateProfile(result.data)`. | Da Angular al primo rendering. |
| **`startEdit()`** | Copia i dati correnti dell’utente in `editForm` e imposta `isEditing = true`. | Click su “Modifica” (o simile) nel template. |
| **`cancelEdit()`** | Chiude la modifica e resetta `editForm`. | Click su “Annulla”. |
| **`saveProfile()`** | Per paziente: chiama `pazienteApi.updatePaziente(dto)` e poi `auth.updateProfile(payload)`; per medico: solo `auth.updateProfile(payload)`. Poi chiude la modifica. | Click su “Salva”. |
| **`formatDate(value)`** | Formatta una data in stringa tipo “1 Gen 2025”. | Usato nel template per le date. |

---

### `MessaggiComponent` (`pages/messaggi/messaggi.component.ts`)

**Ruolo:** pagina “Posta”: chat tra paziente e medico curante o tra medico e lista pazienti. Carica conversazioni e medico/pazienti in base al ruolo; connette il WebSocket; gestisce invio (WebSocket con fallback REST), segna come letti e aggiorna anteprime e badge.

**Utilizzo:** route `messaggi`, protetta da `authGuard`.

**Stato (signal/computed):** `isPaziente`, `myAccountId`, `loading`, `error`, `medicoCurante`, `pazientiList`, `conversationPreviews`, `selectedPaziente`, `receiverId`, `otherPartyName`, `messages`, `nuovoMessaggio`, `wsConnected`, `sending`, `unreadBySender`.

**Metodi principali:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`ngOnInit()`** | Ottiene `myAccountId`; se paziente carica medico e chiama `loadConversationAndConnect`; se medico carica `getConversazioni()` e poi `connectWebSocketForMedico()`. | Da Angular al primo rendering. |
| **`connectWebSocketForMedico()`** | Connette il WS e sottoscrive a `onMessage` per aggiornare `unreadBySender`, anteprime e messaggi della conversazione aperta. | Da `ngOnInit()` quando il ruolo è medico. |
| **`selectPaziente(c)`** | Imposta il paziente selezionato, `receiverId`, nome, azzera errori, chiama `clearUnreadFor` e `loadConversationOnly()`. | Click su un paziente nella lista chat (medico). |
| **`clearUnreadFor(accountId)`** | Azzera i non letti per quell’account in `unreadBySender` e in `conversationPreviews`. | Quando il medico apre una conversazione (`selectPaziente`). |
| **`loadConversationAndConnect()`** | Carica la conversazione via API, segna come letti, connette WS e sottoscrive per aggiungere i nuovi messaggi alla lista. | Dopo aver caricato il medico (paziente). |
| **`loadConversationOnly()`** | Solo GET conversazione + markAsRead (medico, WS già connesso). | Da `selectPaziente()`. |
| **`markAsReadFromOther(senderId, receiverId)`** | Chiama `messageApi.markAsRead` e poi `auth.refreshMessagesUnreadCount()`. | Dopo aver caricato una conversazione. |
| **`invia()`** | Se il testo è valido: connette WS, se connesso invia con `wsService.send()` e aggiunge messaggio ottimistico; altrimenti chiama `sendViaRest()`. | Submit del form di invio messaggio. |
| **`sendViaRest(recId, testo)`** | Invia via `messageApi.sendMessage()` e aggiorna la lista messaggi. | Da `invia()` in fallback quando WS non disponibile/non connesso. |
| **`isFromMe(msg)`** | Restituisce se il messaggio è dell’utente corrente. | Template per allineare i messaggi a destra/sinistra. |
| **`getUnreadCount(accountId)`** | Legge i non letti da `unreadBySender`. | Template. |
| **`getDisplayUnreadCount(c)`** | Somma `unreadCount` dall’API e da `unreadBySender`. | Template lista chat medico. |
| **`formatLastMessageAt(iso)`** / **`formatDate(iso)`** | Formattazione date/orari per lista e dettaglio. | Template. |
| **`tornaIndietro()`** | `location.back()`. | Pulsante “Indietro” (se presente). |
| **`ngOnDestroy()`** | Unsubscribe da tutte le sottoscrizioni raccolte in `sub`. | Da Angular alla uscita dalla route. |

---

### `PazienteDashboardComponent` (`pages/paziente-dashboard/paziente-dashboard.component.ts`)

**Ruolo:** dashboard del paziente: saluto, riepilogo richieste (in attesa, totale, “ultima visita”), lista richieste con filtri (ricerca, stato, periodo), modale per nuova richiesta (tipo, descrizione, id medico), dettaglio richiesta.

**Utilizzo:** route `paziente`, protetta da `pazienteGuard`.

**Stato (signal/computed):** `nomeUtente`, `pazienteNomeCompleto`, `pazienteInitials`, `searchQuery`, `showFilters`, `statiFilter`, `periodFilter`, `modaleNuovaRichiestaAperta`, `modaleInInvio`, `modaleErrore`, `modaleSuccesso`, `formRichiesta`, `richieste`, `richiesteLoading`, `richiesteError`, `richiesteInAttesa`, `totaleRichieste`, `ultimaVisita`, `richiesteFiltrate`, `richiestaSelezionata`, `scelteAttive`.

**Metodi principali:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`ngOnInit()`** | Chiama `caricaRichieste()`. | Da Angular al primo rendering. |
| **`caricaRichieste()`** | Chiama `richiestaMedicaApi.getMieRichieste()` e aggiorna `richieste` / `richiesteError`. | Init e dopo aver inviato una nuova richiesta (setTimeout nel modale). |
| **`getStatoLabel(stato)`** / **`getStatoClass(stato)`** | Etichetta e classe CSS per lo stato. | Template. |
| **`formatDate(date)`** | Formatta la data per le card. | Template. |
| **`toggleFilters()`** / **`isStatoFiltroSelected`** / **`toggleStatoFiltro`** / **`setPeriod`** | Gestione pannello filtri e chip. | Click su filtri e periodi nel template. |
| **`apriModaleNuovaRichiesta()`** / **`chiudiModaleNuovaRichiesta()`** | Apre/chiude il modale e resetta form/errori. | Pulsanti “Nuova richiesta” e “Chiudi”. |
| **`inviaRichiestaMedica()`** | Valida id medico e descrizione; chiama `richiestaMedicaApi.creaRichiesta()`; in successo mostra messaggio e richiama `caricaRichieste()` dopo un breve delay. | Submit del form nel modale nuova richiesta. |
| **`visualizzaRichiesta(richiesta)`** / **`chiudiDettaglioRichiesta()`** | Imposta/azzera `richiestaSelezionata` per il dettaglio. | Click su una richiesta e chiusura del dettaglio. |

---

### `MedicoCuranteDashboardComponent` (`pages/medico-curante-dashboard/medico-curante-dashboard.component.ts`)

**Ruolo:** dashboard del medico: riepilogo (in attesa oggi, accettate settimana, urgenti, scadute, in scadenza), lista richieste con ricerca, filtri (stato, priorità, periodo), pill “tutte/urgenti/brevi/differibili/scadute”, vista lista/grid, paginazione; modale visualizza, modale rifiuta con motivazione, azioni accetta/rifiuta. Sincronizza le richieste in attesa con le notifiche dell’header (setNotifications) e avvia un polling ogni 5 secondi.

**Utilizzo:** route `medico-curante`, protetta da `medicoCuranteGuard`.

**Stato (signal/computed):** `searchQuery`, `viewMode`, `statusFilter`, `priorityFilter`, `periodFilter`, `filtroAttivita`, `showFilters`, `richieste`, `loading`, `error`, `richiestaSelezionata`, `richiestaDaRifiutare`, `motivazioneRifiuto`, `elaborazioneId`, `messaggioErrore`, `paginaCorrente`, `doctorName`, `doctorInitials`, `inAttesaOggi`, `accettateSettimana`, `urgenti`, `scadute`, `inScadenza`, `richiesteFiltrate`, `richiestePaginata`, `pagineTotali`, `scelteAttive`.

**Metodi principali:**

| Metodo | Descrizione | Quando viene invocato |
|--------|-------------|------------------------|
| **`ngOnInit()`** | Chiama `caricaRichieste()` e `avviaPollingRichieste()`. | Da Angular al primo rendering. |
| **`caricaRichieste()`** | Chiama `getRichiesteMedico()`, aggiorna `richieste` e chiama `aggiornaNotifiche()`; in errore azzera le notifiche. | Init e dopo accetta/rifiuta; il polling usa la stessa API senza mostrare errori. |
| **`aggiornaNotifiche()`** | Filtra richieste INVIATA, mappa in `NotificationItem` e chiama `auth.setNotifications(items)`. | Dopo ogni caricamento richieste (e nel polling). |
| **`avviaPollingRichieste()`** | Ogni 5 secondi chiama `getRichiesteMedico()` e aggiorna richieste e notifiche. | Avviato in `ngOnInit()`; fermato in `ngOnDestroy()`. |
| **`getStatoLabel(stato)`** / **`getStatoClass(stato)`** | Etichette e classi CSS per gli stati. | Template. |
| **`getIniziali(paziente)`** | Iniziali nome+cognome. | Template. |
| **`visualizza(richiesta)`** / **`chiudiModale()`** | Apre/chiude il modale dettaglio. | Click su “Visualizza” e chiusura modale. |
| **`onEscape()`** | Chiude il modale dettaglio o il modale rifiuto se aperto. | Listener `document:keydown.escape` (HostListener). |
| **`accetta(richiesta)`** | Chiama `richiestaApi.accettaRichiesta()`, poi chiude il modale e ricarica le richieste. | Click su “Accetta” nel modale. |
| **`apriModaleRifiuta(richiesta)`** / **`chiudiModaleRifiuta()`** / **`confermaRifiuto()`** | Apre modale rifiuto, chiude, invia motivazione con `rifiutaRichiesta()`. | Pulsanti “Rifiuta”, “Chiudi”, “Conferma rifiuto”. |
| **`toggleViewMode()`** / **`selezionaFiltroAttivita(filtro)`** / **`paginaPrecedente()`** / **`paginaSuccessiva()`** / **`toggleFilters()`** / **`isStatoSelected`** / **`toggleStato`** / **`isPrioritaSelected`** / **`togglePriorita`** / **`setPeriod(value)`** | UI: vista lista/grid, pill attività, paginazione, pannello filtri. | Click sui rispettivi controlli nel template. |
| **`ngOnDestroy()`** | Ferma il polling (`clearInterval`). | Da Angular alla uscita dalla route. |

---

## 8. Modelli

### `user.model.ts`

**Ruolo:** definizioni TypeScript per utente e ruolo usate in tutta l’app (auth, profilo, guard).

- **`UserRole`:** tipo union `'Medico_Curante' | 'Paziente'`.
- **`User`:** interfaccia con `id`, `username`, `email`, `nome`, `cognome`, `ruolo`, campi profilo opzionali (`codiceFiscale`, `indirizzoDiResidenza`, `dataDiNascita`, `specializzazione`), `lastLoginAt`, `previousLoginAt`.

---

### `richiesta.model.ts`

**Ruolo:** tipi e interfacce per le richieste mediche (vista paziente e vista medico).

- **`StatoRichiesta`:** stati backend: INVIATA, VISUALIZZATA, ACCETTATA, RIFIUTATA, ANNULLATA, SCADUTA.
- **`StatoRichiestaPaziente`:** stati semplificati per il paziente: in_attesa, accettata, rifiutata, prenotata, scaduta.
- **`RichiestaPaziente`:** id, tipo, stato, dataRichiesta, descrizione (opzionale).
- **`Paziente`:** id, nome, cognome, avatarUrl (opzionale); usato dentro `Richiesta` per il medico.
- **`Richiesta`:** id, paziente, tipo, stato, urgente, dataRichiesta, priorità (opzionale), descrizione (opzionale).

---

## 9. Ambienti

### `environment.ts` / `environment.prod.ts`

**Ruolo:** configurazione per ambiente di sviluppo e produzione. Contiene `production` (boolean) e `apiUrl` (base path per le chiamate API, es. `/prenotazione-medica`).

**Utilizzo:** importato da tutti i servizi API e dall’interceptor per costruire gli URL e da `WebSocketMessageService` per l’endpoint `/ws`. In build production viene usato `environment.prod.ts` (sostituzione file in base a `fileReplacements` in `angular.json`).

---

*Fine documentazione. Per dettagli su template HTML e stili fare riferimento ai file `.html` e `.scss` delle rispettive cartelle.*
