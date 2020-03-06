import React, { Component } from 'react'
import ChatBoard from './ChatBoard/ChatBoard'
import ChatSidebar from './ChatSidebar/ChatSidebar'
import socketIOClient from 'socket.io-client'
import moment from 'moment'
import Context from '../Context/Context'
import {
  checkTokenAndReturn,
  getChannelUsers,
  getChannelMessages
} from '../../api/axios-helpers'
import './Chat.css'

let endpoint =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : 'https://chatty-appy-api.herokuapp.com/'

class Chat extends Component {
  static contextType = Context

  state = {
    messages: null,
    users: null,
    room: this.props.match.params.name || 'General',
    channel: null,
    onTypingMessage: ''
  }

  newSocket = () => {
    this.socket.disconnect()

    let { name } = this.props.match.params

    this.setState({ room: name }, () => {
      this.createSocket()
    })
  }

  componentDidUpdate = prevProps => {
    if (this.context.forcePush) {
      this.context.disableForcePush()
      this.newSocket()
    }
    if (this.props.title && this.props.title !== prevProps.title) {
      this.newSocket()
    }
    if (this.props.match.params.name !== prevProps.match.params.name) {
      this.newSocket()
    }
  }

  onChange = () => {
    this.socket.emit('onTyping', this.context.user)
  }

  componentDidMount() {
    this.createSocket()
  }

  createSocket = async () => {
    try {
      let response = await getChannelUsers(this.state.room)

      if (response.data) {
        this.setState({
          users: response.data.liveMembers,
          messages: response.data.messages,
          roomId: response.data._id,
          channel: response.data
        })
        this.context.setCurrentSelectedChannel(response.data)
      }
    } catch (error) {
      console.log(error)
    }

    this.socket = socketIOClient(endpoint, {
      query: `roomName=${this.state.room}`
    })

    if (!this.state.channel) {
      this.socket.emit('createNewChannel')
    }

    if (localStorage.getItem('token')) {
      this.addLiveMember()
    }

    this.socket.on('chatroomUsers', (users, userId, isRemovingUser) => {
      this.setState({ users: users }, () => {
        if (isRemovingUser) {
          this.socket.disconnect()
          this.socket.off()
          this.createSocket()
        }
      })
    })

    this.socket.on('addChannelToSockets', channel => {
      this.context.addChannelDisplay(channel)
    })

    this.socket.on('removeChannelFromSockets', channel => {
      this.context.removeChannelDisplay(channel)
    })

    this.socket.on('someoneTyping', username => {
      this.setState({ onTypingMessage: `${username} is typing..` }, () => {
        setTimeout(() => {
          this.setState({ onTypingMessage: '' })
        }, 1500)
      })
    })

    this.socket.on('chat', message => {
      this.setState({ messages: [...this.state.messages, message] })
    })
  }

  getMessages = async () => {
    try {
      let response = await getChannelMessages()

      if (response.status === 200) {
        this.setState({ messages: response.data })
      }
    } catch (err) {
      console.log(err.message)
    }
  }

  addChannelToSockets = data => {
    this.socket.emit('addChannelToSockets', data)
  }

  removeChannelFromSockets = data => {
    this.socket.emit('removeChannelFromSockets', data)
  }

  addLiveMember = () => {
    if (
      this.context.user &&
      !this.state.users.find(user => user._id === this.context.user._id)
    ) {
      this.socket.emit('sendUserToServer', this.context.user, this.state.room)
    }
  }

  removeLiveMember = payload => {
    this.socket.emit('removeUserFromActiveChat', payload, this.state.room)
    // this.socket.disconnect()

    this.props.history.push('/channel/General')
  }

  // initialConnect = () => {
  //   let user = checkTokenAndReturn()

  //   if (user) {
  //     let message = {
  //       body: `${user.username} has joined @${this.state.room}`,
  //       author: user._id,
  //       created: moment().format('LT'),
  //       channel: this.state.roomId
  //     }

  //     this.socket.emit('createMessage', message)
  //     return message
  //   } else {
  //     return false
  //   }
  // }

  // terminateConnect = () => {
  //   let { user } = this.context

  //   if (user) {
  //     let message = {
  //       body: `${user.username} has left @${this.state.room}`,
  //       author: user._id,
  //       created: moment().format('LT'),
  //       channel: this.state.roomId
  //     }

  //     this.socket.emit('createMessage', message)
  //   }
  // }

  createMessage = formData => {
    let user = checkTokenAndReturn()

    if (user) {
      let message = {
        ...formData,
        author: user._id,
        created: moment().format('LT'),
        channel: this.state.roomId
      }
      this.socket.emit('createMessage', message)
    }
  }

  render() {
    if (this.context.loginPayload) {
      this.addLiveMember()
      this.context.resetLoginPayload()
    }

    if (this.context.logoutPayload) {
      this.removeLiveMember(this.context.logoutPayload)
      this.context.resetLogoutPayload()
    }

    if (this.context.channelAdded) {
      this.addChannelToSockets(this.context.channelAdded)
      this.context.setChannelAdded(null)
    }

    if (this.context.channelRemoved) {
      this.removeChannelFromSockets(this.context.channelRemoved)
      this.context.setChannelRemoved(null)
    }

    return (
      <div className='chatMain'>
        <ChatBoard
          createMessage={this.createMessage}
          onTyping={this.onChange}
          onTypingMessage={this.state.onTypingMessage}
          messages={this.state.messages}
          roomTitle={this.props.match.params.name}
        />

        <ChatSidebar users={this.state.users} />
      </div>
    )
  }
}

export default Chat
