# Circuit Calcs

Thirty-seven bench calculators in a single HTML file. Each one draws the circuit it is describing,
and the drawing redraws as you type.

**[Open it →](https://ajengineering.github.io/circuit-calcs/)**

![Circuit Calcs](calc.png)

No server, no build step, no dependencies, no account, nothing to install. Download `calc.html`,
open it in a browser, and it works — off a disk, off a USB stick, or from wherever you serve it.
The page loads nothing external and makes no network request at all, so it works with the wire
pulled out and will keep working long after anyone stops maintaining it.

## What is in it

| Group | Calculators |
|---|---|
| Basics | Ohm's law & power · voltage divider, loaded or not · LED series resistor |
| Components | Resistor colour code · SMD resistor code · series & parallel · reactance Xc and XL · TVS / surge protection |
| Filters | Passive RC/RL/RLC filters · active op-amp filters · differential low-pass on a difference amp · LC resonance · LC / π input filter |
| Op-amps | Inverting · non-inverting · difference · comparator with hysteresis · bandwidth & slew rate |
| Power | Adjustable regulator · linear regulator dissipation · buck · boost · zener shunt · BJT base resistor · bridge rectifier, transformer & smoothing · MOSFET gate drive & losses · RC snubber & RCD clamp · inductor saturation & core check · heatsink selection |
| Wire | Wire resistance from diameter · cable size & voltage drop |
| Measurement | Current sense shunt · ADC input front-end · NTC, PT100 & RTD · I²C pull-up & bus capacitance · PCB trace current & width · battery runtime |

## Engineering notation, in and out

Type `4k7`, `100n`, `10u`, `1M`. A letter may stand in for the decimal point, the way it does on a
schematic. **Input is case sensitive on purpose: `M` is mega and `m` is milli.**

Every calculator opens with figures already in it, so you can see what it does before typing
anything. The unit each field expects is written beside it, and stating the unit is optional.

## Where the numbers stop

The cable calculator sizes a run for an allowed drop, reports the voltage actually reaching the
load, and asks for the conductor temperature rather than assuming 20 °C — copper gains 0.39 % per
degree and a loaded cable is not cold. It gives watts per metre and refuses to print a temperature
rise, because that depends on insulation, bundling and ambient air.

For the same reason the AWG table carries diameter, cross-section and Ω/m and no current rating. A
number invented there would be believed.

## Linking to one

Every calculator has its own address, so one can be kept in a tab or sent to someone:

```
https://ajengineering.github.io/circuit-calcs/calc.html#trace
https://ajengineering.github.io/circuit-calcs/calc.html#cable
```

The id is the one in the search box results — `ohm`, `divider`, `led`, `rcolor`, `smd`,
`netcombo`, `react`, `rc`, `lc`, `opinv`, `opnon`, `opdiff`, `hyst`, `opspeed`, `reg`, `ldo`, `buck`, `boost`,
`zener`, `bjt`, `rectifier`, `fet`, `snubber`, `inductor`, `heatsink`, `wire`, `cable`, `shunt`, `adc`, `tempsense`,
`i2c`, `trace`, `batt`, `lcinput`, `activefilter`, `difflp`, `tvs`.

`#about` opens the **About** tab, which carries the version, the licence, what the page keeps in
your browser, and why these calculators are a separate file from the inventory they came out of.

## Searching

The box at the top filters the list. It searches the names, the field labels and the units, so
`awg` finds the cable calculators and `eia96` finds the SMD code reader even though neither word
is in a title.

## What it remembers

The calculator you had open and what you typed into each, in that browser only, through
`localStorage`. Nothing is uploaded anywhere and there is no account. Clearing your browser data
clears it.

## Where it came from

These calculators were part of [Parts Bin](https://github.com/AJEngineering/parts-bin-app), a
component inventory in a single HTML file. They were split out because they are useful on their own
and because a third of that file was calculators — the suggestion came from
[abeyer on the EEVblog forum](https://www.eevblog.com/forum/projects/).

Parts Bin links here from its own toolbar. Nothing is loaded across: the link opens a tab, and each
page still works with no network at all.

## Licence

MIT — free to use, change and redistribute, with attribution. See [LICENSE](LICENSE).
