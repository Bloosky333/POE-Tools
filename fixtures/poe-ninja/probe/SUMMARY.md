# poe.ninja probe

Run at 2026-10-23T23:30:32.961Z

## docs-api

- URL: `https://poe.ninja/docs/api`
- Status: 200, content-type: text/html
- Shape: 95685 chars (non-JSON)

## poe2-leagues

- URL: `https://poe.ninja/poe2/api/economy/leagues`
- Status: 200, content-type: application/json
- Shape: array(6) of { id: string, name: string }

## poe1-leagues

- URL: `https://poe.ninja/poe1/api/economy/leagues`
- Status: 200, content-type: application/json
- Shape: array(4) of { id: string, name: string }

## poe2-data-dumps

- URL: `https://poe.ninja/poe2/data`
- Status: 404, content-type: text/html
- Shape: 36856 chars (non-JSON)

## data-dumps

- URL: `https://poe.ninja/data`
- Status: 404, content-type: text/html
- Shape: 36856 chars (non-JSON)

## exchange-overview-currency-Forbidden Rites

- URL: `https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden%20Rites&type=Currency`
- Status: 200, content-type: application/json
- Shape: { core: { items: array(3) of object, rates: { exalted: number, chaos: number }, primary: string, secondary: string }, lines: array(52) of { id: string, primaryValue: number, volumePrimaryValue: number, maxVolumeCurrency: string, maxVolumeRate: number, sparkline: object }, items: array(52) of { id: string, name: string, image: string, category: string, detailsId: string } }

## currencyexchange-overview-currency-Forbidden Rites

- URL: `https://poe.ninja/poe2/api/economy/currencyexchange/overview?leagueName=Forbidden%20Rites&overviewName=Currency`
- Status: 404, content-type: n/a
- Shape: 0 chars (non-JSON)

## exchange-overview-currency-Runes of Aldur

- URL: `https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur&type=Currency`
- Status: 200, content-type: application/json
- Shape: { core: { items: array(3) of object, rates: { exalted: number, chaos: number }, primary: string, secondary: string }, lines: array(47) of { id: string, primaryValue: number, volumePrimaryValue: number, maxVolumeCurrency: string, maxVolumeRate: number, sparkline: object }, items: array(47) of { id: string, name: string, image: string, category: string, detailsId: string } }

## currencyexchange-overview-currency-Runes of Aldur

- URL: `https://poe.ninja/poe2/api/economy/currencyexchange/overview?leagueName=Runes%20of%20Aldur&overviewName=Currency`
- Status: 404, content-type: n/a
- Shape: 0 chars (non-JSON)

## exchange-details-divine-Forbidden Rites

- URL: `https://poe.ninja/poe2/api/economy/exchange/current/details?league=Forbidden%20Rites&type=Currency&id=divine`
- Status: 404, content-type: application/json; charset=utf-8
- Shape: { type: string, title: string, status: number, traceId: string }
