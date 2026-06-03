import { describe, expect, it } from "vitest";

import { parseDmarcReport } from "../../src/deliverability/dmarc-report";

const SAMPLE = `<?xml version="1.0"?>
<feedback>
  <report_metadata>
    <org_name>google.com</org_name>
    <email>noreply-dmarc@google.com</email>
    <report_id>12345</report_id>
    <date_range><begin>1700000000</begin><end>1700086400</end></date_range>
  </report_metadata>
  <policy_published>
    <domain>example.com</domain>
    <adkim>r</adkim>
    <aspf>r</aspf>
    <p>reject</p>
    <sp>quarantine</sp>
    <pct>100</pct>
  </policy_published>
  <record>
    <row>
      <source_ip>192.0.2.1</source_ip>
      <count>3</count>
      <policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated>
    </row>
    <identifiers><header_from>example.com</header_from></identifiers>
    <auth_results>
      <dkim><domain>example.com</domain><result>pass</result></dkim>
      <spf><domain>example.com</domain><result>pass</result></spf>
    </auth_results>
  </record>
  <record>
    <row>
      <source_ip>198.51.100.2</source_ip>
      <count>1</count>
      <policy_evaluated><disposition>reject</disposition><dkim>fail</dkim><spf>fail</spf></policy_evaluated>
    </row>
    <identifiers><header_from>example.com</header_from></identifiers>
    <auth_results><spf><domain>spoof.example</domain><result>fail</result></spf></auth_results>
  </record>
</feedback>`;

describe(parseDmarcReport, () => {
    it("parses metadata, policy and records", async () => {
        expect.assertions(7);

        const report = await parseDmarcReport(SAMPLE);

        expect(report.organizationName).toBe("google.com");
        expect(report.reportId).toBe("12345");
        expect(report.policyPublished?.p).toBe("reject");
        expect(report.policyPublished?.pct).toBe(100);
        expect(report.records).toHaveLength(2);
        expect(report.records[0]?.count).toBe(3);
        expect(report.records[0]?.authResults.dkim[0]?.result).toBe("pass");
    });

    it("normalizes a single record and a single auth result to arrays", async () => {
        expect.assertions(2);

        const report = await parseDmarcReport(SAMPLE);

        expect(report.records[1]?.disposition).toBe("reject");
        expect(report.records[1]?.authResults.spf).toHaveLength(1);
    });
});
