import { createFileRoute, Link } from "@tanstack/react-router";

import { createSeoHead } from "@/lib/seo";

const RouteComponent = () => (
    <div className="bg-background border-b">
        <div className="container mx-auto prose prose-invert prose-no-margin py-32">
            <p>
                <em>Last updated: 16.05.2025</em>
            </p>
            <h1>General Terms and Conditions</h1>
            <p>General Terms and Conditions between Daniel Bannert and the customer (hereinafter referred to as "Customer")</p>
            <p>
                The following conditions govern the use of the website www.anolilab.com and all associated digital services, channels, and applications. By
                accessing the website and using our services, the Customer agrees to these conditions as binding. If the Customer does not agree to the
                conditions, the use of the website must be discontinued immediately.
            </p>
            <p>The offer is aimed exclusively at entrepreneurs within the meaning of § 14 BGB (German Civil Code).</p>

            <h2>Copyrights and Intellectual Property</h2>
            <p>
                All content on the website – including source code, designs, texts, images, videos, databases, and trademarks – is protected by copyright and,
                unless otherwise indicated, is the property of Daniel Bannert. Commercial use, reproduction, distribution, or processing of this content is
                prohibited without express written permission. All rights reserved.
            </p>
            <p>
                Daniel Bannert (Anolilab) has the right to be named as the author in an appropriate manner on reproductions of the works (e.g., in the imprint
                of the website or in a suitable form for digital products), unless expressly agreed otherwise in writing.
            </p>

            <h2>Ownership of Created Materials</h2>
            <p>
                All original files and designs ("Projects") developed for the Customer as part of a project become the full property of the Customer. Should the
                law provide otherwise, all rights are transferred to the Customer without restriction and permanently.
            </p>
            <p>
                The Customer assures that all provided content and materials are free from third-party rights. Daniel Bannert reserves the right to use
                completed work for his own advertising purposes (e.g., on the website or in social media), unless expressly agreed otherwise – for example,
                through a separate confidentiality agreement.
            </p>

            <h2>Delivery of Project Files and Data Backup</h2>
            <p>
                Unless expressly agreed otherwise in writing, the service of Daniel Bannert (Anolilab) includes the delivery of the final, executable website or
                application according to the service description. The delivery of raw files, draft files, source code versions that are not part of the final
                product, or other non-finalized work materials is not owed, unless this has been separately agreed and, if applicable, remunerated.
            </p>
            <p>
                The Customer is responsible for the regular and proper backup of their own data and content (e.g., content of the content management system,
                databases). Daniel Bannert (Anolilab) assumes no liability for data loss resulting from insufficient data backup by the Customer.
            </p>

            <h2>Use of External Fonts</h2>
            <p>
                If fonts are used in a project for which a separate commercial license is required ("third-party fonts"), the Customer will be informed of this
                in writing. In this case, the Customer undertakes to acquire the corresponding licenses from the respective rights holders themselves. Daniel
                Bannert assumes no liability for any legal infringements due to missing licenses, provided the Customer was informed accordingly beforehand.
            </p>

            <h2>Third-Party Services and Expenses</h2>
            <p>
                Daniel Bannert (Anolilab) is entitled to use subcontractors or third parties (vicarious agents) to fulfill contractual obligations. The use of
                such third parties will be communicated to the Customer upon request.
            </p>
            <p>
                Necessary expenses for the project, such as costs for special licenses (e.g., for stock photos, fonts, software plugins that go beyond standard
                equipment), third-party hosting fees, or travel expenses directly related to the order, will be invoiced separately to the Customer after prior
                consultation and upon presentation of proof.
            </p>

            <h2>Use of the Website – Customer Assurances</h2>
            <p>By using the website, the Customer confirms:</p>
            <ul>
                <li>to be legally competent and to comply with these GTC,</li>
                <li>not to be a minor within the meaning of the applicable legislation,</li>
                <li>not to use automated systems to use the website,</li>
                <li>not to pursue any inadmissible, illegal, or abusive purposes,</li>
                <li>not to violate applicable law.</li>
            </ul>

            <h2>Prohibited Use</h2>
            <p>The website may only be used for purposes related to the services of Daniel Bannert. The following is expressly prohibited:</p>
            <ul>
                <li>Abusive or unauthorized use of the website,</li>
                <li>automated reading of content to create own databases,</li>
                <li>bypassing or manipulating security functions,</li>
                <li>framing or linking without consent,</li>
                <li>technical interference with the operation or infrastructure of the website,</li>
                <li>reverse engineering, decompiling, or disassembling code components,</li>
                <li>uploading malware or excessively burdensome content,</li>
                <li>publishing or transmitting content that violates third-party rights,</li>
                <li>harassment, threatening, or deceiving employees or contractors of Daniel Bannert.</li>
            </ul>

            <h2>Project Duration and Delivery</h2>
            <p>
                Each project begins with a briefing and the provision of all necessary content by the Customer. The delivery of individual tasks/project parts
                takes place within 2-3 working days, provided there are no exceptional circumstances. Projects are processed on weekdays (Monday–Friday,
                excluding public holidays in Bavaria).
            </p>
            <p>
                The Customer undertakes to provide feedback or approvals promptly to avoid delays. Changes and revisions are implemented within the agreed
                processing time.
            </p>
            <p>
                If the execution of the order is delayed for reasons for which the Customer is responsible (e.g., untimely provision of content, materials, or
                information, delayed approvals or decisions), Daniel Bannert (Anolilab) may demand a corresponding extension of the delivery deadlines. If
                Daniel Bannert (Anolilab) incurs additional costs or effort due to such delays for which the Customer is responsible, Daniel Bannert (Anolilab)
                is entitled to invoice these additionally after prior notification and to a reasonable extent.
            </p>

            <h2>Changes and Revisions</h2>
            <p>
                The Customer has the right to request changes to a delivered project. These changes must be within the scope of the originally agreed task.
                Changes that go beyond the original scope will be treated as a new project.
            </p>
            <p>
                Daniel Bannert reserves the right to reject unreasonable change requests or to charge for them separately if they are not covered by a valid
                subscription.
            </p>

            <h2>Creative Freedom</h2>
            <p>
                Within the scope of the order, Daniel Bannert (Anolilab) has creative freedom. Complaints regarding artistic design are excluded. If the
                Customer requests changes during or after production that go beyond the original scope of the order or deviate from already approved drafts, the
                Customer shall bear the resulting additional costs. Daniel Bannert (Anolilab) will inform the Customer in advance about the expected additional
                costs.
            </p>

            <h2>Payment</h2>
            <p>All stated remunerations are net amounts and are subject to the applicable statutory value-added tax, unless expressly stated otherwise.</p>

            <h3>Monthly Subscriptions</h3>
            <p>
                Payment for monthly subscriptions is made via Stripe. The first payment is due immediately upon conclusion of the contract or booking of the
                subscription. Subsequent payments are automatically debited each month on the same calendar day, starting from the date of contract conclusion.
            </p>

            <h3>Individual Projects</h3>
            <p>
                For individual projects not covered by a monthly subscription, the following payment terms apply, unless otherwise agreed in writing in the
                individual offer or contract:
            </p>
            <ul>
                <li>
                    50% of the agreed total amount is due as a down payment upon placing the order. Work on the project usually begins after receipt of this
                    down payment.
                </li>
                <li>
                    A further 25% of the total amount is due after approval of a predefined, significant project milestone (e.g., acceptance of the design
                    concept, completion of a core functionality). This milestone will be specified in the respective offer or project plan.
                </li>
                <li>
                    The remaining 25% of the total amount is due upon final acceptance of the project and before the final handover of all project files or the
                    go-live of the website/application.
                </li>
            </ul>
            <p>Invoices for individual projects are payable without deduction within 14 days of the invoice date, unless otherwise stated.</p>

            <h3>General Payment Provisions</h3>
            <p>
                In the event of payment defaults, whether for subscriptions or individual projects, Daniel Bannert (Anolilab) reserves the right to suspend the
                provision of further services until full payment is received or to restrict access to services already rendered. The Customer shall bear all
                costs associated with the payment default (e.g., chargeback fees, dunning fees within the legal framework).
            </p>
            <p>
                The Customer may only offset claims for remuneration by Daniel Bannert (Anolilab) with undisputed or legally established claims. The Customer
                may only assert a right of retention if it is based on the same contractual relationship.
            </p>

            <h2>Termination and Withdrawal</h2>
            <p>
                The contract can be terminated at any time via the customer account or by written notification. There will be no pro-rata refund for early
                termination. The Customer remains obliged to pay until the end of the respective billing period. After termination, the Customer loses access to
                open or planned projects. Daniel Bannert therefore recommends downloading all final files before termination.
            </p>

            <h2>Refunds</h2>
            <p>As the services are digital services, refunds are generally excluded.</p>
            <p>
                If a project is demonstrably not delivered as agreed, the Customer can request a review. Daniel Bannert reserves the right to offer a credit or
                replacement service in individual cases.
            </p>

            <h2>Usage Rights</h2>
            <p>Upon full payment, the Customer receives a simple, non-transferable right of use for the services rendered under the subscription.</p>
            <p>
                The created designs may be used by the Customer for private or commercial purposes, but may not be resold or licensed to third parties without
                the consent of Daniel Bannert.
            </p>
            <p>Unless otherwise agreed, all copyrights remain with Daniel Bannert.</p>

            <h2>Reference Citation</h2>
            <p>Daniel Bannert reserves the right to publish completed projects for reference purposes on his own website or in social media.</p>
            <p>If the Customer does not wish this, they can communicate this when placing the order or subsequently by e-mail.</p>

            <h2>Data Protection</h2>
            <p>
                The protection of your personal data is very important to us. The collection, processing, and use of your personal data are carried out
                exclusively in compliance with the applicable data protection laws and according to our privacy policy.
            </p>
            <p>
                Our privacy policy, which you can find on our website at <Link to="/privacy">https://anolilab.com/privacy</Link>, is an integral part of these
                General Terms and Conditions. By agreeing to these GTC, you also confirm that you have read and accepted the privacy policy.
            </p>
            <p>
                The Customer, as the controller within the meaning of the General Data Protection Regulation (GDPR) and other applicable data protection laws,
                is responsible for the data protection admissibility of the collection, processing, and use of personal data within the scope of the website or
                application created by Daniel Bannert (Anolilab). This particularly concerns the implementation of tracking tools, cookies (unless technically
                necessary), contact forms, or other functions that process personal data, as initiated by the Customer. Daniel Bannert (Anolilab) acts as a
                processor in this regard according to the Customer's instructions, provided a data processing agreement has been concluded.
            </p>

            <h2>Liability</h2>
            <p>
                Daniel Bannert is liable only for intent and gross negligence. No liability is assumed for indirect damages, such as lost profits or data loss.
            </p>
            <p>The Customer is responsible for the legal review (e.g., copyright, trademark, or competition law aspects) of the delivered content.</p>
            <p>
                Daniel Bannert (Anolilab) is not liable for the admissibility under competition, trademark, design, or copyright law and the registrability of
                the drafts and other design work created within the scope of the order. The review of these legal aspects and the conduct of corresponding
                research (e.g., trademark searches) are the responsibility of the Customer. However, Daniel Bannert (Anolilab) will inform the Customer of any
                known legal risks, insofar as this falls within his duty of care.
            </p>

            <h2>Acceptance and Warranty</h2>
            <p>
                Upon completion of essential parts or the entire project, Daniel Bannert (Anolilab) will request acceptance from the Customer. The Customer
                undertakes to inspect the rendered services within 10 working days of the request and to notify of any defects in writing or to declare
                acceptance. If no substantiated notice of defects is received within this period, the service shall be deemed accepted as per the contract.
            </p>
            <p>
                Upon acceptance, the Customer assumes responsibility for the accuracy and completeness of the content (such as texts, images, and other data)
                provided or approved by the Customer.
            </p>
            <p>
                The warranty period for defects in the services provided by Daniel Bannert (Anolilab) is 12 months from the date of acceptance. Excluded from
                this are defects resulting from improper operation, external influences, or modifications by the Customer or third parties without the consent
                of Daniel Bannert (Anolilab). The liability provisions according to the "Liability" section remain unaffected by this.
            </p>

            <h2>Indemnification</h2>
            <p>
                The Customer undertakes to indemnify and hold harmless Daniel Bannert (Anolilab) from all claims, damages, losses, or costs (including
                reasonable attorneys' fees) arising out of or in connection with (a) a breach of these General Terms and Conditions by the Customer, (b) abusive
                use of the services by the Customer, or (c) a violation of laws or third-party rights by the Customer.
            </p>
            <h2>Confidentiality</h2>
            <p>
                Both parties undertake to maintain confidentiality regarding all information obtained within the scope of the cooperation, even beyond the
                termination of the contractual relationship.
            </p>

            <h2>Maintenance and Updates</h2>
            <p>
                Unless expressly agreed otherwise in writing, further maintenance services, care, or the performance of updates for the services created by
                Daniel Bannert (Anolilab) (e.g., websites or applications) are not included in the original subject matter of the contract. Such services can be
                commissioned and remunerated separately.
            </p>

            <h2>Amendment of the GTC</h2>
            <p>
                Daniel Bannert (Anolilab) reserves the right to amend or supplement these General Terms and Conditions at any time. Changes will be announced to
                the Customer in text form (e.g., by e-mail or by a clear notice on the website) at least 30 days before they take effect.
            </p>
            <p>
                If the Customer does not object to the changes in writing within 30 days of receiving the notification of change, the amended GTC shall be
                deemed accepted. Daniel Bannert (Anolilab) will specifically point out this legal consequence to the Customer in the notification of change. If
                the Customer objects to the amended conditions in due time, Daniel Bannert (Anolilab) is entitled to terminate the contract ordinarily at the
                next possible date. Continued use of the services after the amended GTC come into effect also constitutes acceptance of the new conditions.
            </p>

            <h2>Assignment</h2>
            <p>
                Daniel Bannert (Anolilab) is entitled to transfer the rights and obligations under this contract in whole or in part to a third party. Such a
                transfer will be announced to the Customer in writing in good time, at least four weeks in advance. In the event of a transfer to a third party,
                the Customer has a special right of termination, which can be exercised within 14 days of receiving the notification.
            </p>
            <p>
                The Customer is not entitled to assign or transfer rights or obligations under this contract to third parties without the prior written consent
                of Daniel Bannert (Anolilab).
            </p>

            <h2>Final Provisions</h2>
            <p>German law applies. The place of jurisdiction is the registered office of Daniel Bannert, insofar as legally permissible.</p>
            <p>
                Notices relating to these General Terms and Conditions should be addressed to: danielbannert.com - Daniel Bannert c/o Online-Impressum.de #22125
                Europaring 90 Sankt Augustin, E-mail: security[at]anolilab[dot].de.
            </p>
            <p>
                These General Terms and Conditions, together with all documents expressly mentioned herein (such as the privacy policy), constitute the entire
                agreement between the Customer and Daniel Bannert (Anolilab) with respect to the subject matter of the contract and supersede all prior oral or
                written understandings, agreements, or representations between the parties.
            </p>
            <p>Should individual provisions of these GTC be or become ineffective, the effectiveness of the remaining provisions shall remain unaffected.</p>
        </div>
    </div>
);

export const Route = createFileRoute("/terms")({
    component: RouteComponent,
    head: () => ({
        ...createSeoHead({
            description: "General terms and conditions for Visulima services and website usage.",
            path: "/terms",
            title: "Terms & Conditions",
        }),
    }),
});
