/// <reference types="vite/client" />
import 'react'
import './styles.css'
import { renderToDom } from '@zardoy/react-util'
import Root from './Root'

renderToDom(<Root />, { strictMode: false })
