'use client';
import { KrmxWithSystemProvider, useSystem } from '@/provider/krmx-with-system-provider';
import { useKrmx } from '@krmx/client';
import { useState } from 'react';
import { isPickable, pick, ready } from 'system';

export default function Page() {
  // eslint-disable-next-line no-process-env
  const krmxUrl = process.env.NEXT_PUBLIC_KRMX_URL || 'localhost';
  const [serverUrl] = useState(`ws://${krmxUrl}:8082`);
  return (
    <KrmxWithSystemProvider serverUrl={serverUrl}>
      <KrmxLoginForm />
    </KrmxWithSystemProvider>
  );
}

function KrmxLoginForm() {
  const { username, isConnected, isLinked, link, rejectionReason, leave, users } = useKrmx();
  const { state } = useSystem();
  const [ usernameInput, setUsernameInput ] = useState('');

  if (!isConnected) {
    return (<div className='flex gap-8 items-center'>
      <p className='text-6xl md:text-8xl'>
          😵
      </p>
      <p className='dark:text-white md:text-xl'>
        <span className='font-semibold'>Connection to the server was lost...</span><br/>
        <span className='text-gray-700 dark:text-gray-300'>Please, try again later.</span>
      </p>
    </div>);
  }

  if (!isLinked) {
    return (<>
      <div className="flex items-center mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
        <img className="w-8 h-8 mr-3" src="/apple-touch-icon.png" alt="logo" />
            Christmas Tree
      </div>
      <div className="w-full bg-white rounded-lg shadow dark:border md:mt-0 sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl dark:text-white">
                Join the server
          </h1>
          <form className="space-y-4 md:space-y-6" onSubmit={(e) => {
            link(usernameInput.toLowerCase().trim());
            e.preventDefault();
          }}>
            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Your name
              </label>
              <input
                type="username" name="username" id="username"
                placeholder="username" required
                className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-orange-600 focus:border-orange-600 block
                w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500
                dark:focus:border-blue-500"
                value={usernameInput}
                onChange={(event) => {
                  setUsernameInput(event.target.value);
                }}
              />
              <div className="pt-1 w-full text-right text-sm text-gray-300 dark:text-gray-600">you can only use a-z, A-Z and 0-9</div>
            </div>
            <button
              type="submit"
              className="w-full text-white bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium
              rounded-lg text-sm px-5 py-2.5 text-center dark:bg-orange-600 dark:hover:bg-orange-700 dark:focus:ring-orange-800">
                Join
            </button>
          </form>
          {rejectionReason && <p className="text-sm tracking-tight text-gray-700 dark:text-gray-300">
            Rejected:{' '}
            <span className="tracking-normal text-base font-bold text-red-600 dark:text-red-400">
              {rejectionReason[0].toUpperCase() + rejectionReason.slice(1)}.
            </span>
          </p>}
        </div>
      </div>
    </>
    );
  }

  return (<>
    <div className='w-full bg-white rounded-lg shadow dark:border md:mt-0 sm:max-w-md dark:bg-gray-800 dark:border-gray-700'>
      <div className="px-6 py-2 space-y-3 sm:space-y-4 sm:px-8 sm:py-4">
        <div className='flex items-center justify-between gap-2'>
          <h2 className='text-lg md:text-xl'>
          Hi, <strong>{username[0].toUpperCase() + username.slice(1)}</strong> 👋
          </h2>
          <button className='text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium
              rounded-lg text-sm px-5 py-1 text-center dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-800' onClick={leave}>
          Leave
          </button>
        </div>
        <ul className='flex gap-4 text-sm md:text-base pb-0.5 w-full justify-left border-b border-gray-50 dark:border-gray-700 flex-wrap'>
          {Object.entries(users)
            .filter(([username]) => state.phase === 'lobby' || state.players.includes(username))
            .map(([otherUsername, { isLinked }]) => (
              <li
                key={otherUsername}
                className={`flex items-center gap-2 tracking-tight ${isLinked
                  ? 'text-gray-800 dark:text-gray-200'
                  : 'text-gray-400 dark:text-gray-400'}`}
              >
                <span>{isLinked ? '👤' : '🚫'}</span>
                <span>{otherUsername[0].toUpperCase() + otherUsername.slice(1)}</span>
              </li>),
            )}
        </ul>
      </div>
    </div>
    <Application />
  </>);
}

function Application() {
  const { optimisticState: state, dispatcher } = useSystem();
  const { username } = useKrmx();
  return <>
    <div className='w-full bg-white rounded-lg shadow dark:border md:mt-0 sm:max-w-md dark:bg-gray-800 dark:border-gray-700 overflow-hidden'>
      {state.phase === 'lobby' && (
        <div className="px-6 py-2 space-y-3 sm:space-y-4 sm:px-8 sm:py-4">
          <div className="flex justify-between">
            <h2 className="font-bold text-xl">Lobby</h2>
            {username in state.lobby && state.lobby[username].isReady
              ? <button
                className="text-white bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium
                  rounded-lg text-sm px-5 py-1 text-center dark:bg-orange-600 dark:hover:bg-orange-700 dark:focus:ring-orange-800"
                onClick={() => dispatcher(ready(false))}
              >
                Un-Ready
              </button>
              : <button
                className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium
                  rounded-lg text-sm px-5 py-1 text-center dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
                onClick={() => dispatcher(ready(true))}
              >
                Ready
              </button>
            }
          </div>
          {state.starting === -1
            ? (<p>
              Waiting for{' '}
              <strong className="font-bold">
                {Object
                  .keys(state.lobby)
                  .filter(n => !state.lobby[n].isReady)
                  .map(username => username[0].toUpperCase() + username.slice(1))
                  .join(' and ')
                }
              </strong>
              {' '}to ready up!
            </p>)
            : <p>Starting in {state.starting - state.tick}...</p>
          }
        </div>)}
      {state.phase === 'playing' && <>
        <div className='px-6 py-2 space-y-3 sm:space-y-4 sm:px-8 sm:py-4 font-bold text-center'>
          {state.spectators.includes(username) && 'Welcome. You are spectating!' }
        </div>
        <div className='w-full mb-4 flex flex-col gap-1'>
          {state.tree.map((slice, y) => {
            return <div className='w-full flex justify-center gap-1 items-center'>
              {slice.map((block, x) => {
                if (block === undefined) {
                  return <div className='w-6 h-6 border rounded border-dashed border-gray-300
                  dark:border-gray-900 bg-gray-200 dark:bg-gray-700'/>;
                }
                const pickable = isPickable(state.tree, x, y);
                return <button
                  className={
                    'w-6 h-6 border rounded flex items-center justify-center text-xl font-bold ' +
                    `border-green-200 dark:border-green-900 bg-green-300 dark:bg-green-800 ${pickable
                      ? 'font-extrabold text-green-900 dark:text-green-100'
                      : 'text-green-500 dark:text-green-600 cursor-default'}`
                  }
                  onClick={() => {
                    dispatcher(pick({ x, y }));
                  }}
                >
                  {block}
                </button>;
              })}
            </div>;
          })}
        </div>
        <ul className="flex flex-wrap w-full bg-gray-100 dark:bg-gray-700 pt-2 pb-1.5 px-2 gap-2 items-center justify-center">
          {state.players.map((player, i) => {
            const shownName = player === username ? 'you' : player;
            const isTurn = state.turn === player;
            return <>
              {i !== 0 ? <li className='text-sm text-gray-300 dark:text-gray-500 font-bold'>&gt;</li> : undefined}
              <li className={`flex gap-2 items-center border rounded-md px-2 ${isTurn
                ? 'bg-amber-400 border-amber-300 dark:bg-amber-600 dark:border-amber-700'
                : 'bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`}>
                <div>{shownName[0].toUpperCase() + shownName.slice(1)}</div>
                <div className="font-bold text-lg">{state.scores[player]}</div>
              </li>
            </>;
          })}
        </ul>
      </>}
      {state.phase === 'finished' && <>
        <div className="px-6 py-2 space-y-3 sm:space-y-4 sm:px-8 sm:py-4">
          <p className="text-8xl float-right">🎄</p>
          <h2 className="font-bold text-xl">And the winner is...</h2>
          <ul>
            {Object.keys(state.scores).sort((a, b) => state.scores[b] - state.scores[a]).map((name, i) => {
              const podium = i > 3 ? 3 : i;
              const classNames = [
                'text-4xl text-amber-400 font-extrabold drop-shadow py-2',
                'text-xl text-gray-800 dark:text-gray-300 font-bold drop-shadow py-1',
                'text-amber-600 font-bold drop-shadow py-1',
                'text-xs text-gray-700 dark:text-gray-400 py-1',
              ][podium];
              return <li className='flex gap-2 items-baseline pb-2'>
                <span className='text-xs'>{i + 1}.</span>
                <span className={classNames} >
                  {name[0].toUpperCase() + name.slice(1)} - {state.scores[name]} points
                </span>
              </li>;
            })}
          </ul>
        </div>
      </>}
    </div>
    {state.spectators.length > 0 &&
      <div className='flex w-full sm:max-w-md justify-center mb-4'>
        <ul
          className="flex flex-wrap gap-2 items-center border-b border-dashed px-1
                   border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300"
        >
          <li className="tracking-tighter text-xs pr-2 text-gray-400 dark:text-gray-500">spectators</li>
          {state.spectators.map((spectator, i) => <>
            {i !== 0 ? <li className='text-xs text-gray-300 dark:text-gray-700'>/</li> : undefined}
            <li className='text-sm'>
              {spectator[0].toUpperCase() + spectator.slice(1)}
            </li>
          </>)}
        </ul>
      </div>
    }
    {state.phase === 'playing' &&
      <div className='w-full bg-white rounded-lg shadow dark:border md:mt-0 sm:max-w-md dark:bg-gray-800 dark:border-gray-700 overflow-hidden'>
        <div className="px-6 py-2 space-y-3 sm:space-y-4 sm:px-8 sm:py-4">
          <h2 className="w-full border-b border-gray-200 pb-1 dark:border-gray-700 font-bold text-xl">Legend</h2>
          <ul className='flex flex-col gap-3'>
            {[
              { item: '1-9', explanation: 'Score that many points!' },
              { item: '🎁', explanation: 'Score 3 points, add +1 to surrounding AND take another turn.' },
            ].map(({ item, explanation }) => <li className='flex gap-1'>
              <span className='flex-shrink-0 font-bold w-8 inline-block'>{item}</span>
              <span className='inline-block text-gray-700 dark:text-gray-400'>{explanation}</span>
            </li>)}
          </ul>
        </div>
      </div>
    }
  </>;
}
