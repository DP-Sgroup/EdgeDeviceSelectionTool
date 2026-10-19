# Standard interpretation and release decisions

Source: DPS_IMS_STAND0001, *DPS Digitalisation Platform — Product Naming & Coding Standard*, v1.0, issued 4 February 2026. The source PDF remains the authority. This implementation does not revise it.

## Implemented rules

- Edge: `DPS Edge [Series] [VV]-[EI]-[T6]-[S]-[O]-[PU]`
- Cyber: `DPS Cyber [VV]-[EI]-[FW]-[T6]-[W]-[PU]`
- Net: `DPS Net [VV]-[EI]-[T6]-[C]-[PU]`
- ASCII separators are used for ERP-safe copying. The typographic separator after the display name is normalized to a space.
- Enclosure X allows IP digit 0 or 2; B requires 0. No additional enclosure combinations are assumed prohibited by the standard.
- Zero physical ports render as `0X`. Nonzero counts require a real type. Alphabetic counts use A=10 through Z=35, except X, which is reserved. The wizard cannot encode 33 pending a controlled clarification.
- Only standard-defined subsystem and option codes are available. Embedded Net is X only. HMI E means 15 inches, not 14.
- Wireless has a standalone field only for Cyber. No new wireless field is added to Edge or Net.

## Decisions requiring a controlled standard revision

1. **Light / Lite**: §5.1 specifies `Light`; the requested commercial name is DPS Edge Lite. The UI shows Lite / Light, but the SKU retains `Light`. Rename only after a revised standard is approved.
2. **Embedded EI=XX**: all three §5.8.2 examples use `XX`, contrary to §5.3's enclosure-letter/IP-digit rules. They are retained verbatim as lookup references. The wizard does not allow XX for standalone EI. Embedded hardware remains unresolved pending a documented inherited-enclosure exception or corrected lookup.
3. **X count collision**: §5.5's alphabetic count sequence conflicts with reserved X at 33. Block 33 rather than silently encode none.
4. **Build mappings**: the standard defines capability classes, not validated assemblies. Enclosure, power, firewall hardware, accessories, licences, wiring, labour and test procedures must be mapped and reviewed separately. All BoMs are drafts in this release.

## DPS Edge Lite hardware addition

- Manufacturer: Siemens
- Part: `6ES7647-0BW00-1YA2`
- SIMATIC IOT2050 Industrial Edge (ARM64); 2 GB RAM; 16 GB eMMC; 2 × Gigabit RJ45; 24 VDC; device IP20.
- Product: https://sieportal.siemens.com/en-ww/products-services/detail/6ES7647-0BW00-1YA2
- Siemens catalogue: https://mall.industry.siemens.com/mall/en/WW/Catalog/Product/6ES7647-0BW00-1YA2
- Siemens technical data: https://support.industry.siemens.com/teddatasheet/?caller=SIOS&format=pdf&language=en&mlfbs=6ES76470BW001YA2
- Reviewed 19 October 2026. No price is supplied or estimated.

Default `1G1G0X` assumes one port assigned to WAN and one to LAN; these are physical interfaces, not a verified router/firewall feature. Other requested counts or connector types create an engineering gap. Additional switching requires a released assembly mapping; an extra manual line does not certify it. Confirm ARM64 application compatibility and the installed software/device release during engineering review.

## Controlled change process

Keep code meanings immutable. Add new definitions with a new standard/catalogue revision, validate known SKUs and assembly mappings, and retain pricing provenance and release approval. A syntactically valid part number must never automatically become a production-approved build.
