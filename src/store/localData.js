import Vue from 'vue'

const Store = require('electron-store')
const store = new Store()

const LOADED_TAB_LIMIT = 10
const DEAD_TAB_LIMIT = 15
const HISTORY_LIMIT = 350

class LocalData {
  constructor(init) {
    let data = init || {
      assetDir: '',
      tabData: {
        activeTabKey: "000",
        tabs: {
          "000": {
            key: "000",
            url: '/',
            title: '',
            hasEmbed: false,
            history: [],
            future: []
          }
        },
        tabList: [
          "000"
        ],
        sortedTabList: [
          "000"
        ],
        closedTabList: [
        ]
      },
      saveData: {
        saves: {
        },
        saveList: [
        ]
      }
    }

    const initSettings = {
      newReader: {
        current: '001901',
        limit: '001902'
      },
      notifications: true,
      subNotifications: false,

      showAddressBar: true,
      urlTooltip: true,
      switchToNewTabs: false,
      forceScrollBar: true,
      hideFullscreenHeader: false,
      smoothScrolling: true,
      pixelScaling: true,
      mspaMode: false,
      bandcampEmbed: true,
      allowSysUpdateNotifs: true,
      devMode: false,
      enableHardwareAcceleration: false,

      themeOverride: "default",
      themeOverrideUI: "default",
      forceThemeOverride: false,
      forceThemeOverrideUI: false,

      textOverride: {
        fontFamily: "",
        bold: false,
        fontSize: 0,
        lineHeight: 0,
        paragraphSpacing: false,
        highContrast: false,
      },
      arrowNav: true,
      openLogs: false,
      hqAudio: true,
      jsFlashes: true,
      credits: true,

      fastForward: false,

      retcon1: true,
      retcon2: true,
      retcon3: true,
      retcon4: true,
      retcon5: true,
      retcon6: true,

      bolin: false,
      soluslunes: false,
      unpeachy: false,
      pxsTavros: false,
      cursedHistory: false,

      modListEnabled: []  // name hardcoded in mods.js, be careful
    }

    // Data will only contain settings if the app has already been used.
    // In this case, copy replace all default values with the user's values
    if (data.settings) {
      Object.keys(data.settings).forEach(setting => {
        if (setting in initSettings) initSettings[setting] = data.settings[setting]
      })
      delete data.settings
    }
    this.VM = new Vue({ 
      data: () => ({
        ...data,
        settings: initSettings,
        temp: {
          visited: [],
          loadedTabList: [],
          tabChainIndex: undefined
        }
      }),
      computed: {
        activeTabIndex() {
          return this.tabData.sortedTabList.indexOf(this.tabData.activeTabKey)
        },
        activeTabObject() {
          return this.tabData.tabs[this.tabData.activeTabKey]
        },
        allHistory() {
          return this.tabData.tabList.map(
            key => this.tabData.tabs[key]
          ).reduce((a, t) => {
            a.push(t.url)
            return a.concat(t.history)
          }, [])
        },
        openUrls() {
          return this.tabData.tabList.map(
            key => this.tabData.tabs[key]
          ).map(tab => tab.url)
        }
      },
      methods: {
        saveLocalStorage() {
          let timestamp = Date.now()
          let assetDir = this.assetDir
          let tabData = this.tabData
          let saveData = this.saveData
          let settings = this.settings
          
          store.set("localData", {
            assetDir,
            timestamp,
            tabData,
            saveData,
            settings
          })
        },
        reloadLocalStorage() {
          let back = store.get('localData', {})

          this.assetDir = back.assetDir
          this.tabData = back.tabData
          this.saveData = back.saveData
          this.settings = back.settings
          console.log(this.settings)
        },
        HISTORY_CLEAR() {
          this.tabData.tabList.forEach(k => {
            this.tabData.tabs[k].history = []
          })
          this.saveLocalStorage()
        },
        TABS_RESET() {
          this.$set(this, 'tabData', {
            activeTabKey: "000",
            tabs: {
              "000": {
                key: "000",
                url: '/',
                title: '',
                hasEmbed: false,
                history: [],
                future: []
              }
            },
            tabList: [
              "000"
            ],
            sortedTabList: [
              "000"
            ],
            closedTabList: [
            ]
          })
          this.temp.loadedTabList = []
          this.temp.tabChainIndex = undefined

          this.saveLocalStorage()
        },

        TABS_PUSH_URL (url="/", key = this.tabData.activeTabKey) {
          window.getSelection().empty()
          document.getElementById(key).scrollTop = 0
          document.getElementById(key).scrollLeft = 0

          this.tabData.tabs[key].history.push(this.tabData.tabs[key].url)
          this.tabData.tabs[key].future = []
          while (this.tabData.tabs[key].history.length > HISTORY_LIMIT) this.tabData.tabs[key].history.shift()
          this.$set(this.tabData.tabs[key], 'url', url)
          
          this.saveLocalStorage()
        },

        TABS_NEW (url = '/', adjacent = false) {
          let key
          do {
            key = Math.random().toString(36).substring(2, 5)
          } while (key in this.tabData.tabs)

          this.$set(this.tabData.tabs, key, {
            key: key,
            url: url,
            title: '',
            hasEmbed: false,
            history: [],
            future: []
          })

          this.tabData.tabList.push(key)

          // If adjacent, chain new tabs along in sequence next to the current tab. Otherwise, place tab at end of array
          if (adjacent) {
            this.temp.tabChainIndex = this.temp.tabChainIndex ? this.temp.tabChainIndex+1 : this.activeTabIndex+1
            this.tabData.sortedTabList.splice(this.temp.tabChainIndex, 0, key)
          }
          else {
            this.tabData.sortedTabList.push(key)
          }

          if (this.tabData.tabList.length > this.tabData.sortedTabList.length) this.TABS_RESYNC()

          if (!adjacent || this.tabData.tabList.length == 1 || this.settings.switchToNewTabs){
            this.TABS_SWITCH_TO(key)
          }
          else {
            // TABS_SWITCH_TO also saves localStorage, so we only need to run this here if we're not switching tabs
            this.saveLocalStorage()
          }
        },

        TABS_DUPLICATE (target = this.tabData.activeTabKey, adjacent = true, historyMode = false) {
          if (target in this.tabData.tabs) {
            let key
            do {
              key = Math.random().toString(36).substring(2, 5)
            } while (key in this.tabData.tabs)

            this.tabData.tabList.push(key)
            
            // If adjacent, chain new tabs along in sequence next to the current tab. Otherwise, place tab at end of array
            if (adjacent) {
              this.temp.tabChainIndex = this.temp.tabChainIndex ? this.temp.tabChainIndex+1 : this.activeTabIndex+1
              this.tabData.sortedTabList.splice(this.temp.tabChainIndex, 0, key)
            }
            else {
              this.tabData.sortedTabList.push(key)
            }
            
            let targetTab = this.tabData.tabs[target]

            let url = targetTab.url
            let history = [...targetTab.history]
            let future = [...targetTab.future]

            if (historyMode == 'back') {
              future.push(url)
              url = history.pop()
            }
            else if (historyMode == 'forward') {
              history.push(url)
              url = future.pop()
            }
            console.log(history)
            
            this.$set(this.tabData.tabs, key, {
              key: key,
              url,
              title: '',
              hasEmbed: false,
              history,
              future
            })

            if (this.tabData.tabList.length > this.tabData.sortedTabList.length) this.TABS_RESYNC()

            this.TABS_SWITCH_TO(key)
          }
          else console.warning(`Tried to duplicate nonexistent key '${target}'`)
        },

        TABS_SWITCH_TO(key = this.tabData.activeTabKey) {
          this.temp.tabChainIndex = undefined
          
          if (this.tabData.tabList.includes(key)) {
            this.tabData.activeTabKey = key
          }

          this.saveLocalStorage()
        },

        TABS_CYCLE(amount = 1) {
          let newIndex  = this.tabData.sortedTabList.indexOf(this.tabData.activeTabKey) + amount
          if (newIndex < 0) newIndex = this.tabData.sortedTabList.length + newIndex
          else if (newIndex >= this.tabData.sortedTabList.length) newIndex = newIndex - this.tabData.sortedTabList.length
          this.TABS_SWITCH_TO(this.tabData.sortedTabList[newIndex])
        },

        TABS_PUSH_TO_LOADED_LIST (key) {
          if (key) {
            if (!this.temp.loadedTabList.includes(key)) {
              this.temp.loadedTabList.push(key)
              while (this.temp.loadedTabList.length > LOADED_TAB_LIMIT) this.temp.loadedTabList.shift()
            } else {
              this.temp.loadedTabList.splice(this.temp.loadedTabList.indexOf(key), 1)
              this.temp.loadedTabList.push(key)
            }
          }

          this.saveLocalStorage()
        },

        TABS_CLOSE (key = this.tabData.activeTabKey) {
          if (!this.tabData.tabList.includes(key) || this.tabData.tabList.length <= 1) return

          if (key === this.tabData.activeTabKey){
            let activeIndex = (this.activeTabIndex >= this.tabData.sortedTabList.length-1) ? this.tabData.sortedTabList.length-2 : this.activeTabIndex + 1
            this.TABS_SWITCH_TO(this.tabData.sortedTabList[activeIndex])
          }

          let sortedIndex = this.tabData.sortedTabList.indexOf(key)

          this.tabData.tabList.splice(this.tabData.tabList.indexOf(key), 1)
          this.tabData.sortedTabList.splice(this.tabData.sortedTabList.indexOf(key), 1)
          this.temp.loadedTabList.splice(this.temp.loadedTabList.indexOf(key), 1)

          this.tabData.closedTabList.push({key: key, index: sortedIndex})
          while (this.tabData.closedTabList.length > DEAD_TAB_LIMIT) {
            this.tabData.closedTabList.shift()
          }

          let tabsToKeep = [...this.tabData.tabList]
          this.tabData.closedTabList.forEach(closedTab => {
            tabsToKeep.push(closedTab.key)
          })

          let toClear =  Object.keys(this.tabData.tabs).filter(x => !tabsToKeep.includes(x))

          toClear.forEach(key => {
            if (key in this.tabData.tabs) {
              this.$delete(this.tabData.tabs, key)
            }
          })

          if (this.tabData.tabList.length <= 0) {
            this.TABS_NEW()
          }

          if (this.tabData.tabList.length > this.tabData.sortedTabList.length) this.TABS_RESYNC()

          this.saveLocalStorage()
          // Dont remove tab from tab object, so it can be re-opened
        },

        TABS_CLOSE_ON_RIGHT(key = this.tabData.activeTabKey) {
          let hitlist = this.tabData.sortedTabList.slice(this.tabData.sortedTabList.indexOf(key)+1, this.tabData.sortedTabList.length)
          hitlist.reverse().forEach(key => this.TABS_CLOSE(key))
        },

        TABS_CLOSE_ALL_OTHERS(key = this.tabData.activeTabKey) {
            let hitlist = [...this.tabData.sortedTabList]
            hitlist.splice(this.tabData.sortedTabList.indexOf(key), 1)
            hitlist.reverse().forEach(key => this.TABS_CLOSE(key))
        },

        TABS_RESTORE() {
          if (this.tabData.closedTabList.length > 0) {
            let tab = this.tabData.closedTabList.pop()
            this.tabData.tabList.push(tab.key)
            this.tabData.sortedTabList.splice(tab.index, 0, tab.key)
            this.TABS_SWITCH_TO(tab.key)
          }

          if (this.tabData.tabList.length > this.tabData.sortedTabList.length) this.TABS_RESYNC()
        },

        TABS_RESYNC() {
          let lostTabs = this.tabData.tabList.filter(key => !this.tabData.sortedTabList.includes(key))
          lostTabs.forEach(key => {
            this.tabData.sortedTabList.push(key)
          })
        },

        TABS_SET_TITLE(key, title) {
          if (!key) {
            console.warn("Can't set title of a tab you haven't sent me")
            return
          }
          this.tabData.tabs[key].title = title

          this.saveLocalStorage()
        },

        TABS_SET_HASEMBED(key, hasEmbed) {
          if (!key) {
            console.warn("Can't set hasEmbed of a tab you haven't sent me")
            return
          }
          this.tabData.tabs[key].hasEmbed = hasEmbed

          // this.saveLocalStorage()
        },

        TABS_SWAP(key1, key2) {
          this.temp.tabChainIndex = undefined

          let index1 = this.tabData.sortedTabList.indexOf(key1)
          let index2 = this.tabData.sortedTabList.indexOf(key2)
          if (index1 < 0 || index2 < 0) {
            console.warn(`One of the tabs you're trying to swap doesn't exist. Tab 1: ${key1}, Tab 2: ${key2}`)
            return
          }
          this.$set(this.tabData.sortedTabList, index1, key2)
          this.$set(this.tabData.sortedTabList, index2, key1)
        },
        
        TABS_HISTORY_FORWARD() {
          let tab = this.tabData.tabs[this.tabData.activeTabKey]
          if (tab.future.length > 0) {
            window.getSelection().empty()
            document.getElementById(tab.key).scrollTop = 0
            document.getElementById(tab.key).scrollLeft = 0

            tab.history.push(tab.url)
            tab.url = tab.future.pop()
          }
          
          this.saveLocalStorage()
        },
        TABS_HISTORY_BACK() {
          let tab = this.tabData.tabs[this.tabData.activeTabKey]
          if (tab.history.length > 0) {
            window.getSelection().empty()
            document.getElementById(tab.key).scrollTop = 0
            document.getElementById(tab.key).scrollLeft = 0

            tab.future.push(tab.url)
            tab.url = tab.history.pop()
          }

          this.saveLocalStorage()
        },

        SAVES_NEW(name, url) {
          let key
          do {
            key = Math.random().toString(36).substring(2, 5)
          } while (key in this.saveData.saves)
          this.$set(this.saveData.saves, key, {key, name, url})
          this.saveData.saveList.unshift(key)

          this.saveLocalStorage()

          return key
        },
        SAVES_EDIT(key, name, url) {
          this.saveData.saves[key].name = name
          this.saveData.saves[key].url = url

          this.saveLocalStorage()
        },
        SAVES_SWAP(key1, key2) {
          let index1 = this.saveData.saveList.indexOf(key1)
          let index2 = this.saveData.saveList.indexOf(key2)
          if (index1 < 0 || index2 < 0) {
            console.warn(`One of the tabs you're trying to swap doesn't exist. Tab 1: ${key1}, Tab 2: ${key2}`)
            return
          }
          this.$set(this.saveData.saveList, index1, key2)
          this.$set(this.saveData.saveList, index2, key1)
        },
        SAVES_DELETE(key){
          if (key in this.saveData.saves) {
            this.saveData.saveList.splice(this.saveData.saveList.indexOf(key), 1)
            this.$delete(this.saveData.saves, key)

            this.saveLocalStorage()
          }
        },
        NEW_READER_SET(current = false, limit = false) {
          if (current) this.settings.newReader.current = current
          if (limit) this.settings.newReader.limit = limit

          this.saveLocalStorage()
        },
        NEW_READER_CLEAR() {
          this.settings.newReader.current = false
          this.settings.newReader.limit = false

          this.settings.retcon1 = true
          this.settings.retcon2 = true
          this.settings.retcon3 = true
          this.settings.retcon4 = true
          this.settings.retcon5 = true
          this.settings.retcon6 = true
          
          this.saveLocalStorage()
        },
        SET_ASSET_DIR(path) {
          this.assetDir = path
          this.saveLocalStorage()
        }
      }
    })
    
    this.VM.saveLocalStorage()
  }

  get root() {
    return this.VM
  }

  get assetDir() {
    return this.VM.$data.assetDir
  }

  get tabData() {
    return this.VM.$data.tabData
  }

  get saveData() {
    return this.VM.$data.saveData
  }

  get settings() {
    return this.VM.$data.settings
  }

  get temp() {
    return this.VM.$data.temp
  }

  get allHistory() {
    return this.VM.allHistory
  }
}

export default {
  Store: LocalData,
  install (Vue, options) {
    Vue.mixin({
      beforeCreate() {
        this.$localData = options.store
      }
    })
  },
}