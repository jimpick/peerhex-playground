import React, { useState, useEffect, useMemo } from 'react'
import { FlyToInterpolator } from 'react-map-gl'
import { geoToH3 } from 'h3-js'
import produce from 'immer'
import { useLocation } from 'react-router-dom'
import locations from './locations'
import H3HexagonView from './h3-hexagon-view'
import ResolutionSelect from './resolution-select'
import LocationPicker from './location-picker'
import getPeerIdFromH3HexAndSecret from './deterministic-peer-id'

// var array = new Uint8Array(64); crypto.getRandomValues(array)
// Array.from(array).map(b => b.toString(16).padStart(2, "0")).join('')
const secretHex =
  '105471fbca3674e6b45709a56381891e133618ada169e52496907d461be55760' +
  '02998949f060111889810320f8ff4f57b58734c187896ecf4daa44baeba9553f'

export default function H3HexagonMVT () {
  const [resolution, setResolution] = useState(7)
  const [dataSolid, setDataSolid] = useState([])
  const [dataClear, setDataClear] = useState([])
  const [dataWireframe1, setDataWireframe1] = useState([])
  const [nextColor, setNextColor] = useState(0)
  const location = useLocation()
  const [initialViewState, setInitialViewState] = useState({
    ...locations.sfo,
    maxZoom: 20,
    minZoom: 1
  })
  const [viewState, setViewState] = useState({})
  const [dataLayer, setDataLayer] = useState('solid')
  const [selectedHex, setSelectedHex] = useState()
  const [peerId, setPeerId] = useState()
  useEffect(() => {
    setPeerId(null)
    if (selectedHex) {
      async function run () {
        const peerId = await getPeerIdFromH3HexAndSecret(
          selectedHex[1],
          secretHex
        )
        setPeerId(peerId)
      }
      run()
    }
  }, [selectedHex])

  useEffect(() => {
    const key = location.hash.slice(1)
    if (locations[key]) {
      const initialViewState = {
        ...locations[key],
        transitionInterpolator: new FlyToInterpolator({
          speed: 1.5
        }),
        transitionDuration: 'auto',
        maxZoom: 20,
        minZoom: 1
      }
      setInitialViewState(initialViewState)
    }
  }, [location])

  function getDataAndSetter (layer) {
    let data
    let setDataNew
    if (layer === 'solid') {
      data = dataSolid
      setDataNew = setDataSolid
    } else if (layer === 'clear') {
      data = dataClear
      setDataNew = setDataClear
    } else if (layer === 'wireframe1') {
      data = dataWireframe1
      setDataNew = setDataWireframe1
    } else {
      throw 'nope'
    }
    return [data, setDataNew]
  }

  function pushLatLng (lat, lng) {
    const hex = geoToH3(lat, lng, resolution)
    const colorIndex = nextColor % 10
    const newDataPoint = {
      hex,
      // count: 30 * (9.682 - Math.log((resolution + 1) * 1000)),
      count:
        1000 * (1 / Math.log((resolution + 2) * (resolution + 2)) / 10) - 17.5,
      colorIndex
    }
    setNextColor(colorIndex + 1)
    const [data, setDataNew] = getDataAndSetter(dataLayer)
    const nextData = produce(data, draft => {
      draft.push(newDataPoint)
    })
    setDataNew(nextData)
  }

  function pickHex (layer, hex) {
    setSelectedHex([layer, hex])
  }

  function removeHex (layer, hexToRemove) {
    const [data, setDataNew] = getDataAndSetter(layer)
    const nextData = produce(data, draft => {
      draft.splice(
        0,
        draft.length,
        ...draft.filter(({ hex }) => hex !== hexToRemove)
      )
    })
    setDataNew(nextData)
  }

  return (
    <div>
      <div style={{ display: 'flex' }}>
        <ResolutionSelect
          resolution={resolution}
          setResolution={setResolution}
        />
        <LocationPicker flatten={flatten} />
      </div>
      <div style={{ display: 'flex' }}>
        <div
          style={{
            position: 'relative',
            width: '55vw',
            height: '80vh',
            background: '#64828c'
          }}
        >
          <H3HexagonView
            dataSolid={dataSolid}
            dataClear={dataClear}
            dataWireframe1={dataWireframe1}
            initialViewState={initialViewState}
            pushLatLng={pushLatLng}
            pickHex={pickHex}
            setViewState={setViewState}
            selectedHex={selectedHex}
          />
        </div>
        <div>
          <h3>Selected</h3>
          {selectedHex && (
            <>
              <div>
                Hex: {selectedHex[1]} {selectedHex[0]}
              </div>
              <div style={{ fontSize: 'small' }}>
                PeerID: {peerId && peerId.toB58String()}
              </div>
              <div>
                <button
                  onClick={() => {
                    removeHex(selectedHex[0], selectedHex[1])
                    setSelectedHex(null)
                  }}
                >
                  Delete
                </button>
                <button onClick={() => setSelectedHex(null)}>Deselect</button>
              </div>
            </>
          )}
        </div>
      </div>
      <form>
        <label>
          <input
            type='radio'
            name='dataLayer'
            value='solid'
            checked={dataLayer === 'solid'}
            onChange={() => setDataLayer('solid')}
          />
          Solid
        </label>
        <label>
          <input
            type='radio'
            name='dataLayer'
            value='clear'
            checked={dataLayer === 'clear'}
            onChange={() => setDataLayer('clear')}
          />
          Clear
        </label>
        <label>
          <input
            type='radio'
            name='dataLayer'
            value='wireframe1'
            checked={dataLayer === 'wireframe1'}
            onChange={() => setDataLayer('wireframe1')}
          />
          Wireframe 1
        </label>
      </form>
    </div>
  )

  function flatten (event) {
    const initialViewState = {
      ...viewState,
      pitch: 0,
      bearing: 0,
      transitionInterpolator: new FlyToInterpolator(),
      transitionDuration: 1000
    }
    setInitialViewState(initialViewState)
    event.preventDefault()
  }
}
