<template>
  <transition name="modal">
    <div class="modalMask" v-if="isActive" tabindex="-1" @keydown.esc="close()" @click.self="close()">
      <div class="modalContainer" >
        <div class="modalContent" ref="modalContent">
          <MediaEmbed :url="url" ref="media" webarchive="true" @blockedevent="onBlockedEvent"/>
        </div>
        <div class="modalLinks">
          <span v-text="splitPath[0]" @click.prevent="openItemInFolder" /> - <span v-text="splitPath[1].replace(/%20/g, ' ')" @click.prevent="openItem" />
        </div>
        <FlashCredit :pageId="this.contentId"/>
      </div>
    </div>
  </transition>
</template>


<script>
import MediaEmbed from '@/components/UIElements/MediaEmbed.vue'
import FlashCredit from '@/components/UIElements/FlashCredit.vue'
const { shell } = require('electron')

export default {
  name: 'modal',
  props: ['tab'],
  components: {
    MediaEmbed, FlashCredit
  },
  data() {
    return{
      isActive: false,
      url: undefined
    }
  },
  computed: {
    splitPath() {
      // Returns folder that the file is stored in, and the filename itself
      return [this.url.slice(0, this.url.lastIndexOf('/')), this.url.slice(this.url.lastIndexOf('/')+1)]
    },
    contentId() {
      return this.$getResourceURL(this.url)
    }
  },
  methods: { 
    open(url) {
      this.url = url
      this.isActive = true
      this.$nextTick(()=>{
        this.$el.focus()
      })
    },
    close(){
      this.url = undefined
      this.isActive = false 
    },
    openItem() {
      shell.openPath(this.$mspaFileStream(this.url))
    },
    openItemInFolder() {
      shell.showItemInFolder(this.$mspaFileStream(this.url))
    },
    onBlockedEvent(){
      this.$refs.modalContent.classList.add('animDisabledEvent')
      setTimeout(() => {
        this.$refs.modalContent.classList.remove('animDisabledEvent')
      }, 500)
    }
  },
  watch: {
    'tab.url'() {
      this.close()
    }
  }
}
</script>

<style scoped lang="scss">

.modalMask {
  z-index: 3;
  background-color: rgba(0, 0, 0, 0.85);
  position: fixed;

  width: 100%;
  height: calc(100% - var(--headerHeight));
  overflow: hidden;

  display: flex;
  flex: 1 0 auto;
  flex-flow: column;
  justify-content: center;
  align-items: center;
}

.modalContainer {
  max-width: 95%;
  max-height: 85%;
  margin-top: -25px;

  position: relative;

  display: flex;
  flex-flow: column;
  justify-content: center;
  align-items: center;
  align-content: center;
}

.modalContent {
  width: 100%;
  height: 100%;
  overflow: auto;

  * {
    display: block;
  }
  webview {
    display: flex;
  }
}

.modalLinks {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  color: #ffffffcc;
  
  span {
    color: #ffffffcc;
    font-size: 12px;
    font-weight: normal;
    font-family: Verdana, Geneva, sans-serif;
    transition: color 0.15s;
      user-select: none;

    &:hover {
      text-decoration: underline;
      cursor: pointer;
      color: #ffffff;
    }
  }
}

.modal-enter-active, .modal-leave-active  {
  transition: all 0.15s;
  .modalContainer {
    transition: all 0.15s;
  }
}
.modal-enter, .modal-leave-to {
  background-color: #00000000;

  .modalContainer {
    transform: scale(0);
    opacity: 0;
  }
}
.animDisabledEvent{
  position: relative;

  @keyframes onDisabledEvent {
    0%   {left: 0px;}
    25%  {left: 5px;}
    50%  {left: 0px;}
    75%  {left: -5px;}
    100% {left: 0px;}
  }    
  animation-name: onDisabledEvent;
  animation-duration: 200ms;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}
</style>
