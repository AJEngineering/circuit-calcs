# Circuit Calcs

Twenty-five bench calculators in a single HTML file. Each one draws the circuit it is describing,
and the drawing redraws as you type.

**[Open it →](https://ajengineering.github.io/circuit-calcs/)**

No server, no build step, no dependencies, no account, nothing to install. Download `calc.html`,
open it in a browser, and it works — off a disk, off a USB stick, or from wherever you serve it.
The page loads nothing external and makes no network request at all, so it works with the wire
pulled out and will keep working long after anyone stops maintaining it.

## What is in it

| Group | Calculators |
|---|---|
| Basics | Ohm's law & power · voltage divider · LED series resistor |
| Components | Resistor colour code · SMD resistor code · series & parallel · reactance Xc and XL |
| Filters | RC filter & time constant · LC resonance |
| Op-amps | Inverting · non-inverting · difference · comparator with hysteresis |
| Power | Adjustable regulator · linear regulator dissipation · buck · boost · zener shunt · MOSFET losses · heatsink selection |
| Wire | Wire resistance from diameter · cable size & voltage drop |
| Measurement | Current sense shunt · PCB trace width (IPC-2221) · battery runtime |

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

The id is the one in the search box results — `ohm`, `divider`, `led`, `rcolor`, `smd`, `netcombo`,
`react`, `rc`, `lc`, `opinv`, `opnon`, `opdiff`, `hyst`, `reg`, `ldo`, `buck`, `boost`, `zener`,
`fet`, `heatsink`, `wire`, `cable`, `shunt`, `trace`, `batt`.

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
