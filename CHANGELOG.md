# Changelog

All changes players can notice are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The first version of Wormhole Surfing: ride a cute spaceship through a swirling wormhole with a chibi girl in the cockpit. Golden orbs speed you up, blue sparks slow you down, and the farther you fly, the rarer the warp holes: plain ones, ones with one or two golden halos, and the rarest with a flower-shaped aura.
- Slow down too much and the holes start to pull; too slow, and the next hole takes you in whatever you do.
- Eight 3D worlds behind the holes: the Cliffs, the Lagoon, the Canyon and the Caverns behind red, blue, green and yellow holes, and four strange worlds behind white ones: the Crystal Sea, the Star Dunes, the Floating Gardens and the Aurora Void.
- In each world the girl walks to a pillar of light and opens a star capsule. What it holds is decided at random by the hole's rarity and the distance flown: forty treasures in five rarities, sometimes shiny. A flower-aura hole always holds its world's legendary treasure until you have it.
- A collection of every treasure found, with pictures, counts and shiny finds, kept in the browser.
- Play with keyboard, mouse, game controller, touch screen or by tilting the device. Menus work with a controller too.
- Settings for sound, music, graphics quality, tilt steering and its range, inverted flying, mouse steering, camera speed, vibration, less motion and a frame counter. English and German.
- Music and sounds generated live, in a mood of their own for every world.
- The game installs as an app and plays offline.
- A cockpit panel shows the ship's speed on a rainbow gauge, with the pull of holes on an inner arc, and the orbs, sparks, time and your farthest ride on glowing seven-segment LCDs; in a world, where you are, how far you flew and how near the treasure is. The light-years at the top are an LCD too.
- A new treasure flies from its card into its place in the collection when you open the collection from there, and lands with a pop; others found since your last look pop in their places, and the Collection button counts them.
- Share your collection: a picture of every world's treasures with your numbers goes to your phone's share sheet, or is saved with a text to post copied, where there is no share sheet.
- Every treasure has a short description. Tap or click a found treasure in the collection to see it up close, with its rarity, world, how often it was found, how many were shiny, and a list of every find with its date, distance, world and hole.
- The girl wears swimming shoes: deep water no longer stops her, she swims across it with her head above the surface, and ripples ring around her in water.
- An about page with what the game is, how it is made, your data, the debug log and every change, in place of the small about box.
- Export your save as a file and import it again, to keep a backup or to carry your treasures to another browser or device. Both are on the about page and in the settings.
- An exportable debug log: your device and graphics chip, how fast frames came each second, and any glitches, errors and long frames, to send along with a bug report.
- The browser keeps the debug logs of your last three sessions, so a glitch can still be reported after a reload or a crash; each can be exported from the about page and the settings.
- Report a problem straight from the debug log: on GitHub, with the details filled in, or by email. The log is saved as a file to attach.
- The about page has a contact address and a link to the issue tracker, and shows how to install the game as an app in the browser, or links to the web version in the installed app.
- While the 3D engine loads, a bar shows how much has arrived, how fast, how long it took and how long it should still take.
- On foot, the arrow keys turn the camera; WASD walks.
- The frame counter in the settings also shows the time per frame, the resolution and the draw calls. It sits in the top left corner, clear of the panels.

### Changed

- The Caverns are lighter and glow less, so the cave can be seen; a soft light goes along with the girl in dark worlds.

### Fixed

- On Macs and other computers with a real graphics chip, the picture no longer turns black except for a strip at the edge: a glint of light on the ship could overflow and spread across the screen.
- After switching the graphics quality, as to Ultra, the picture no longer stays black.
- The picture no longer flashes black for a frame when the game changes its resolution to keep up, as it often did right after arriving in a world.
- In the Lagoon and the Crystal Sea, the girl no longer gets stuck at the edge of deep water.
- The girl no longer walks into the treasure capsule; she stops at its pedestal.
- On phones, help, the settings and the other dialogs fit the screen and scroll with a finger; before, they ran off the bottom of the screen.
- At the start of a ride the ship no longer darts toward the mouse pointer, which still rests on the button that started the ride: the mouse steers once it is moved during the ride, or clicked on the game.
