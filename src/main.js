import Vue from 'vue'
import App from './App'
import router from './router'
import localData from './store/localData'
// import path from 'path'

import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faExternalLinkAlt, faChevronUp, faChevronRight, faChevronDown, faChevronLeft, 
  faSearch, faEdit, faSave, faTrash, faTimes, faPlus, faPen, faMusic, faLock, 
  faRedo, faStar, faRandom, faMousePointer, faBookmark, faTerminal
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import Memoization from '@/memoization.js'

const Store = require('electron-store')
const store = new Store()

const log = require('electron-log');
log.transports.console.format = '[{level}] {text}';

library.add([
  faExternalLinkAlt, faChevronUp, faChevronRight, faChevronDown, faChevronLeft, 
  faSearch, faEdit, faSave, faTrash, faTimes, faPlus, faPen, faMusic, faLock, 
  faRedo, faStar, faRandom, faMousePointer, faBookmark, faTerminal
])

Vue.component('fa-icon', FontAwesomeIcon)

Vue.config.productionTip = false

Vue.use(localData, {
  store: new localData.Store(store.get('localData'))
})

const {shell, ipcRenderer} = require('electron')
const {port, appVersion} = ipcRenderer.sendSync('STARTUP_GET_INFO')

const Resources = require("@/resources.js")
Resources.init({
  assets_root: `http://127.0.0.1:${port}/`
})

// Must init resources first.
import Mods from "./mods.js"

window.doFullRouteCheck = Mods.doFullRouteCheck

// Mixin mod mixins
Mods.getMixins().forEach((m) => Vue.mixin(m))

// eslint-disable-next-line no-extend-native
Number.prototype.pad = function(size) {
  if (isNaN(this))
    return undefined
  var s = String(this)
  while (s.length < (size || 2)) 
    s = "0" + s
  return s
}

Vue.mixin(Memoization.mixin)

Vue.mixin({
  data(){
    return {
      $appVersion: appVersion,
      $expectedAssetVersion: '2'
    }
  },
  computed: {
    $localhost: () => `http://127.0.0.1:${port}/`,
    $archive() {return this.$root.archive},
    $isNewReader() {
      return this.$newReaderCurrent && this.$localData.settings.newReader.limit
    },
    $newReaderCurrent() {
      return this.$localData.settings.newReader.current
    },
    $modChoices: Mods.getModChoices,
    $logger() {return log.scope(this.$options.name || this.$options._componentTag || "undefc!")}
  },
  methods: {
    $resolvePath(to){
      // Resolves a logical path within the vue router
      // Currently just clamps story URLS to the user specified mspamode setting
      const route = this.$router.resolve(to).route
      const base = route.path.split("/")[1]

      let resolvedUrl = route.path

      if (!this.$localData.settings.mspaMode && base == 'mspa') {
        // Route /mspa/# to /homestuck/#
        const vizNums = this.$mspaToViz(route.params.p)
        if (vizNums) resolvedUrl = `/${vizNums.s}/${vizNums.p}`
      } else if (this.$localData.settings.mspaMode) {
        if (base == 'mspa') {
          let p_padded = route.params.p.padStart(6, '0')
          if (p_padded in this.$archive.mspa.story) resolvedUrl =  `/mspa/${p_padded}` 
        } else if (this.$isVizBase(base)) {
          // Route /homestuck/# to /mspa/#
          const mspaNums = this.$vizToMspa(base, route.params.p)
          if (mspaNums.p) resolvedUrl = `/mspa/${mspaNums.p}`
        }
      }
      return resolvedUrl
    },
    $openModal(to) {
      this.$root.$children[0].$refs[this.$localData.tabData.activeTabKey][0].$refs.modal.open(to)
    },
    $openLink(url, auxClick = false) {
      const urlObject = new URL(url.replace(/(localhost:8080|app:\/\/\.\/)index\.html\??/, '$1'))

      if (urlObject.protocol == "assets:" && !/\.(html|pdf)$/i.test(url)) {
        this.$openModal(Resources.resolveAssetsProtocol(url))
        return
      }
      
      // Else, tests
      let to = (/mspaintadventures/.test(urlObject.href) && !!urlObject.search) ? urlObject.href : urlObject.pathname
      to = to.replace(/.*mspaintadventures.com\/(\w*\.php)?\?s=(\w*)&p=(\w*)/, "/mspa/$3")
             .replace(/.*mspaintadventures.com\/\?s=(\w*)/, "/mspa/$1")

      if (!/(app:\/\/\.(index)?|\/\/localhost:8080)/.test(urlObject.origin)) {
        // Link is external
        if (urlObject.href.includes('steampowered.com/app')) {
          ipcRenderer.invoke('steam-open', urlObject.href)
        } else shell.openExternal(Resources.resolveURL(urlObject.href))
      } else if (/\.(html|pdf)$/i.test(to)){
        // TODO: Not sure resolveURL is needed here? This should always be external?
        shell.openExternal(Resources.resolveURL(to))
      } else if (/\.(jpg|png|gif|swf|txt|mp3|wav|mp4|webm)$/i.test(to)){
        this.$logger.error("UNCAUGHT ASSET?", to)
        this.$openModal(to)
      } else if (auxClick) {
        this.$localData.root.TABS_NEW(this.$resolvePath(to), true)
      } else {
        this.$pushURL(to)
      }
    },
    $getResourceURL: Resources.getResourceURL,
    $getChapter: Resources.getChapter,
    $filterURL(u) {return this.$getResourceURL(u)},
    $pushURL(to, key = this.$localData.tabData.activeTabKey){
      const url = this.$resolvePath(to)
      this.$localData.root.TABS_PUSH_URL(url, key)
    },
    $mspaFileStream(url) {
      return Resources.resolvePath(url, this.$localData.assetDir)
    },
    $getStory(pageNumber){
      pageNumber = parseInt(pageNumber) || pageNumber

      // JAILBREAK
      if (pageNumber <= 135 || pageNumber == "jb2_000000"){
        return 1
      }      
      // BARD QUEST
      else if (pageNumber >= 136 && pageNumber <= 216) {
        return 2
      }
      // BLOOD SPADE
      else if (pageNumber == "mc0001") {
        return 3
      }      
      // PROBLEM SLEUTH
      else if (pageNumber >= 219 && pageNumber <= 1892){
        return 4
      }      
      // HOMESTUCK BETA
      else if (pageNumber >= 1893 && pageNumber <= 1900){
        return 5
      }      
      // HOMESTUCK
      else if (pageNumber >= 1901 && pageNumber <= 10030 || (pageNumber == "pony" || pageNumber == "pony2" || pageNumber == "darkcage" || pageNumber == "darkcage2")){
        return 6
      }

      return undefined
    },
    $getAllPagesInStory(story_id, incl_secret=false) {
      const page_nums = []
      if (story_id == '1'){
        for (let i = 2; i <= 6; i++) page_nums.push(i.pad(6))
        for (let i = 8; i <= 135; i++) page_nums.push(i.pad(6))
        page_nums.push("jb2_000000")
      } else if (story_id == '2'){
        page_nums.push(Number(136).pad(6))
        for (let i = 171; i <= 216; i++) page_nums.push(i.pad(6))
      } else if (story_id == '3'){
        page_nums.push("mc0001")
      } else if (story_id == '4'){
        for (let i = 219; i <= 991; i++) page_nums.push(i.pad(6))
        for (let i = 993; i <= 1892; i++) page_nums.push(i.pad(6))
      } else if (story_id == '5'){
        for (let i = 1893; i <= 1900; i++) page_nums.push(i.pad(6))
      } else if (story_id == '6'){
        for (let i = 1901; i <= 4298; i++) page_nums.push(i.pad(6))
        for (let i = 4300; i <= 4937; i++) page_nums.push(i.pad(6))
        for (let i = 4939; i <= 4987; i++) page_nums.push(i.pad(6))
        for (let i = 4989; i <= 9801; i++) page_nums.push(i.pad(6))
        for (let i = 9805; i <= 10030; i++) page_nums.push(i.pad(6))
        if (incl_secret) {
          page_nums.push("darkcage")
          page_nums.push("darkcage2")
          page_nums.push("pony")
          page_nums.push("pony2")
        }
      } else if (story_id == 'ryanquest'){
        for (let i = 1; i <= 15; i++) page_nums.push(i.pad(6))
      }

      if (story_id == 'snaps') {
        for (let i = 1; i <= 64; i++) page_nums.push(String(i))
      }
      return page_nums
    },
    $vizToMspa(vizStory, vizPage) {
      let mspaPage
      const vizNum = !isNaN(vizPage) ? parseInt(vizPage) : undefined
      const pageNotInStory = (mspaPage) => this.$archive ? !(mspaPage in this.$archive.mspa.story || mspaPage in this.$archive.mspa.ryanquest) : false

      switch (vizStory) {
        case 'jailbreak':
          mspaPage = (vizNum == 135) ? 'jb2_000000' : (vizNum + 1).toString().padStart(6, '0')
          if (1 > vizNum || vizNum > 135 || pageNotInStory(mspaPage)) return {s: undefined, p: undefined}
          break
        case 'bard-quest':
          mspaPage = (vizNum == 1) ? "000136" : (vizNum + 169).toString().padStart(6, '0')
          if (1 > vizNum || vizNum > 47 || pageNotInStory(mspaPage)) return {s: undefined, p: undefined}
          break
        case 'blood-spade':
          if (vizNum == 1) mspaPage = "mc0001"
          else return {s: undefined, p: undefined}
          break
        case 'problem-sleuth':
          mspaPage = (vizNum + 218).toString().padStart(6, '0')
          if (1 > vizNum || vizNum > 1674 || pageNotInStory(mspaPage)) return {s: undefined, p: undefined}
          break
        case 'beta':
          mspaPage = (vizNum + 1892).toString().padStart(6, '0')
          if (1 > vizNum || vizNum > 8 || pageNotInStory(mspaPage)) return {s: undefined, p: undefined}
          break
        case 'homestuck':
          mspaPage = vizNum ? (vizNum + 1900).toString().padStart(6, '0') : vizPage
          if (1 > vizNum || vizNum > 8130 || pageNotInStory(mspaPage)) return {s: undefined, p: undefined}
          break
        case 'ryanquest':
          mspaPage = vizNum.toString().padStart(6, '0')
          if (1 > vizNum || vizNum > 15 || pageNotInStory(mspaPage)) return {s: undefined, p: undefined}
          break
      }
      return {s: vizStory == 'ryanquest' ? 'ryanquest' : this.$getStory(mspaPage), p: mspaPage}
    },
    $mspaToViz(mspaInput, isRyanquest = false){
      const mspaPage = (this.$archive && mspaInput.padStart(6, '0') in this.$archive.mspa.story) ? mspaInput.padStart(6, '0') : mspaInput
      const mspaStory = this.$getStory(mspaPage)
      const pageNotInStory = this.$archive ? !(mspaPage in this.$archive.mspa.story || mspaPage in this.$archive.mspa.ryanquest) : false

      let vizStory, vizPage

      if (isRyanquest) {
        if (pageNotInStory) return undefined
        return {s: 'ryanquest', p: parseInt(mspaPage).toString() }
      } else if (pageNotInStory) {
        return undefined
      } else {
        switch (mspaStory) {
          case 1:
            vizStory = "jailbreak"
            vizPage = (mspaPage == 'jb2_000000') ? '135' : (parseInt(mspaPage) - 1).toString()
            break
          case 2:
            vizStory = "bard-quest"
            if (parseInt(mspaPage) == 136) vizPage = "1"
            else vizPage = (parseInt(mspaPage) - 169).toString()
            break
          case 3:
            vizStory = "blood-spade"
            vizPage = "1"
            break
          case 4:
            vizStory = "problem-sleuth"
            vizPage = (parseInt(mspaPage) - 218).toString()
            break
          case 5:
            vizStory = "beta"
            vizPage = (parseInt(mspaPage) - 1892).toString()
            break
          case 6:
            vizStory = "homestuck"
            vizPage = isNaN(mspaPage) ? mspaPage : (parseInt(mspaPage) - 1900).toString()
            break
        }
        return {s: vizStory, p: vizPage}
      }
    },
    $isVizBase(base){
      return ['jailbreak', 'bard-quest', 'blood-spade', 'problem-sleuth', 'beta', 'homestuck'].includes(base)
    },
    $mspaOrVizNumber(mspaId){
      // Formates a mspaId as either an mspaId or viz number, depending on user settings.
      // Future Gio: This used to be here:
      // || !(mspaId in this.$archive.mspa.story)
      // We shouldn't need that, but if something breaks, that's why.
      return this.$localData.settings.mspaMode 
        ? mspaId 
        : this.$mspaToViz(mspaId).p
    },
    $parseMspaOrViz(userInput, story = 'homestuck') {
      // Takes a user-formatted string and returns a MSPA page number.
      // The output page number may not be real!
      if (Number.isInteger(userInput)) {
        this.$logger.waring("parseMspaOrViz got int, not string: ", userInput)
        userInput = String(userInput)
      }
      if (this.$localData.settings.mspaMode) {
        return userInput.replace(/^0+/, '').padStart(6, '0')
      } else {
        return this.$vizToMspa(story, userInput).p
      }
    },
    $updateNewReader(thisPageId, forceOverride = false) {
      const isSetupMode = !this.$archive
      const isNumericalPage = /\D/.test(thisPageId)
      const endOfHSPage = (this.$archive ? this.$archive.tweaks.endOfHSPage : "010030")
      const isInRange = '000219' <= thisPageId && thisPageId <= endOfHSPage // in the "keep track of spoilers" range

      if (!isNumericalPage && isInRange && (isSetupMode || thisPageId in this.$archive.mspa.story)) {
        let nextLimit

        // Some pages don't directly link to the next page. These are manual exceptions to catch them up to speed
        if (!isSetupMode) {
          // Calculate nextLimit
          var offByOnePages = this.$archive.tweaks.offByOnePages

          if (offByOnePages.includes(thisPageId)) {
            nextLimit = (parseInt(thisPageId) + 1).pad(6)
          }

          // End of problem sleuth
          else if (thisPageId == '001892') nextLimit  = '001902'

          // A6 CHARACTER SELECTS
          else if ('006021' <= thisPageId && thisPageId <= '006094') nextLimit = '006095' // Jane+Jake
          else if ('006369' <= thisPageId && thisPageId <= '006468') nextLimit = '006469' // Roxy+Dirk

          // A6A5A1x2 COMBO
          else if ('007688' <= thisPageId && thisPageId <='007825') {
            // Sets the next page an extra step ahead to account for the x2 shittery
            const isLeftPage = !(thisPageId % 2)
            const page = this.$archive.mspa.story[thisPageId]
            const nextPageOver = this.$archive.mspa.story[page.next[0]].next[0]
            let nextPageId 
            if (isLeftPage) {
              nextPageId = this.$archive.mspa.story[nextPageOver].next[0]
            } else {
              nextPageId = nextPageOver
            }
            nextLimit = nextPageId
          }
          // IF NEXT PAGE ID IS LARGER THAN WHAT WE STARTED WITH, JUST USE THAT
          // On normal pages, always pick the lowest next-pageId available. The higher one is a Terezi password 100% of the time
          else nextLimit = [...this.$archive.mspa.story[thisPageId].next].sort()[0]
        }
        // Safeguard to catch an unset nextLimit
        if (isSetupMode || !nextLimit) nextLimit = thisPageId

        if (thisPageId == endOfHSPage) {
          // Finished Homestuck.
          this.$localData.root.NEW_READER_CLEAR()
          this.$root.$children[0].$refs.notifications.allowEndOfHomestuck()
        } else {
          const resultCurrent = (forceOverride || !this.$newReaderCurrent || this.$newReaderCurrent < thisPageId) ? thisPageId : false
          const resultLimit = (forceOverride || !this.$localData.settings.newReader.limit || this.$localData.settings.newReader.limit < nextLimit) ? nextLimit :  false

          // If you've reached that page where a retcon happened, mark the flag.
          if (resultCurrent) {
            this.$localData.settings.retcon1 = (resultCurrent >= '007999')
            this.$localData.settings.retcon2 = (resultCurrent >= '008053')
            this.$localData.settings.retcon3 = (resultCurrent >= '008317')
            this.$localData.settings.retcon4 = (resultCurrent >= '008991')
            this.$localData.settings.retcon5 = (resultCurrent >= '009026')
            this.$localData.settings.retcon6 = (resultCurrent >= '009057')
          }
          
          if (resultCurrent || resultLimit) {
            this.$localData.root.NEW_READER_SET(resultCurrent, resultLimit)
            if (!isSetupMode) this.$popNotifFromPageId(resultCurrent)
          }
        }
      } else this.$logger.warn(`Invalid page ID '${thisPageId}', not updating progress`)
    },
    $shouldRetcon(retcon_id){
      console.assert(/retcon\d/.test(retcon_id), retcon_id, "isn't a retcon ID! Should be something like 'retcon4'")
      // If fast-forward, always retcon.
      if (this.$localData.settings.fastForward)
        return true

      // Else, only if the flag is set.
      return this.$localData.settings[retcon_id]
    },
    $popNotifFromPageId(pageId) {
      this.$root.$children[0].$refs.notifications.queueFromPageId(pageId)
    },
    $pushNotif(notif) {
      this.$root.$children[0].$refs.notifications.queueNotif(notif)
    },
    $timestampIsSpoiler(timestamp){
      if (!this.$isNewReader) return false

      const latestTimestamp = this.$archive.mspa.story[this.$newReaderCurrent].timestamp
      let nextTimestamp
      try {
        nextTimestamp = this.$archive.mspa.story[this.$archive.mspa.story[this.$newReaderCurrent].next[0]].timestamp
      } catch {
        this.$logger.warn("Couldn't get 'next page' for timestampIsSpoiler")
        nextTimestamp = latestTimestamp
      }

      if (timestamp > nextTimestamp) {
        // this.$logger.info(`Checked timestamp ${timestamp} is later than ${latestTimestamp}, spoilering`)
        // const { DateTime } = require('luxon');
        // let time_zone = "America/New_York"
        // this.$logger.info(`Checked timestamp ${DateTime.fromSeconds(Number(timestamp)).setZone(time_zone).toFormat("MM/dd/yy")} is earlier than ${DateTime.fromSeconds(Number(latestTimestamp)).setZone(time_zone).toFormat("MM/dd/yy")}, spoilering`)
        
        return true
      } else return false
    },
    $pageIsSpoiler(page, useLimit = false) {
      // The new-reader setting is split into two values: "current", and "limit"
      // "current" is the highest page the reader has actually visited. By setting "useLimit" to false, you can use this function to only display content up to a point the reader has seen.
      // "limit" is the highest page the reader is *allowed* to visit. This is generally set one page ahead of the current page, but in some circumstances like character select screens, it can go much further.
      
      // "Hiveswap Friendsim" and "Pesterquest" are pseudopages used by the bandcamp viewer
      // to reference tracks and volumes, i.e. "Pesterquest: Volume 14"

      if (!this.$archive) return true // Setup mode

      const parsedLimit = parseInt(this.$localData.settings.newReader[useLimit ? 'limit' : 'current'])
      const parsedPage = parseInt(page)
      return this.$isNewReader && (
        (page in this.$archive.mspa.story && (
          (!!parsedPage && parsedLimit < parsedPage) ||
          (page == 'pony' && parsedLimit < (useLimit ? 2839 : 2838)) ||
          (page == 'darkcage' && parsedLimit < (useLimit ? 6274 : 6273)) ||
          (page == 'pony2' && parsedLimit < (useLimit ? 6518 : 6517)) ||
          (page == 'darkcage2' && parsedLimit < (useLimit ? 6928 : 6927))
        )) || page.includes('Hiveswap Friendsim: ') || page.includes('Pesterquest: ')
      )
    },
    $trackIsSpoiler(ref) {
      if (this.$isNewReader && ref in this.$archive.music.tracks) {
        const track = this.$archive.music.tracks[ref]
        // Try to find a single linked page or album that isn't a spoiler. If we can't, block it.
        // if it's referenced by an unreleased track, that's not good enough. it has to be reference that unreleased track *itself* 
        // From the unreleased track's perspective: if it's referenced by a known track, it's ok. Whether or not it references a known track shouldn't affect it.
        
        return !(
          (track.pages && track.pages.find(page => !this.$pageIsSpoiler(page))) ||
          (track.album && track.album.find(album => {
            if (album == 'unreleased-tracks' && track.referencedBy) {
              return track.referencedBy.find(track => !this.$trackIsSpoiler(track))
            } else return !this.$albumIsSpoiler(album)
          }))
        )
      } else return false
    },
    $albumIsSpoiler(ref) {
      if (this.$isNewReader && ref in this.$archive.music.albums && this.$archive.music.albums[ref].date) {
        // It's a spoiler if it belongs to an album with a more recent timestamp than the current page
        let date

        if (ref == 'homestuck-vol-1') date = this.$archive.mspa.story['002340'].timestamp // During third Rose GameFAQs, after Nanna expodump
        else if (ref == 'homestuck-vol-5') date = this.$archive.mspa.story['003841'].timestamp // Curtains after [S] Descend
        else if (ref == 'homestuck-vol-6') date = this.$archive.mspa.story['005127'].timestamp // During LE/Recap 3 Huss interruption
        else if (ref == 'song-of-skaia') date = this.$archive.mspa.story['006291'].timestamp // Immediately after EOA6I1
        else if (ref == 'colours-and-mayhem-universe-b') date = this.$archive.mspa.story['006716'].timestamp // Immediately after DOTA, before EOY3 shown
        else if (ref == 'homestuck-vol-9') date = this.$archive.mspa.story['006928'].timestamp // After Terry: FF to Liv, before cherub chess
        else if (ref == 'symphony-impossible-to-play') date = this.$archive.mspa.story['007162'].timestamp // Just after Caliborn: Enter, before openbound 1
        else if (ref == 'one-year-older') date = this.$archive.mspa.story['007162'].timestamp // Just after Caliborn: Enter, before openbound 1
        else if (ref == 'cherubim') date = this.$archive.mspa.story['007882'].timestamp // After Interfishin, right when Caliborn/Calliope expodump begins

        else date = new Date(this.$archive.music.albums[ref].date).getTime()/1000
        this.$logger.debug(ref, this.$archive.mspa.story['006716'].timestamp)
        return date > this.$archive.mspa.story[this.$newReaderCurrent].timestamp
      } else return false
    }
  } 
})

window.vm = new Vue({
  data(){
    return {
      archive: undefined,
      loadState: undefined
    }
  },
  computed: {
    // Easy access
    app(){ return this.$refs.App },
    tabTheme(){ return this.app.tabTheme }
  },
  router,
  render: function (h) { return h(App, {ref: 'App'}) },
  watch: {
    '$localData.settings.devMode'(to, from){
      const is_dev = to
      log.transports.console.level = (is_dev ? "silly" : "info");
      this.$logger.silly("Verbose log message for devs")
      this.$logger.info("Log message for everybody")
      this.$localData.VM.saveLocalStorage()
    }
  }
}).$mount('#app')

// Even though we cancel the auxclick, reallly *really* cancel mouse navigation.
window.addEventListener("mouseup", (e) => {
  if (e.button === 3 || e.button === 4){
    window.vm.$logger.info("blocking mouse navigation")
    e.preventDefault()
  }
})

// Expose for debugging
window.Resources = Resources
window.Mods = Mods
