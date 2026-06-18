-- Seed 5 test chat-log entries for steven.clydeford.net.
-- Test IPs use the 203.0.113.0/24 documentation range (RFC 5737) so they are
-- obviously synthetic and easy to clean up later.
INSERT INTO chat_logs (site, ip, created_at, updated_at, request_count, transcript) VALUES
('steven.clydeford.net', '203.0.113.10', '2026-06-18T09:12:04.000Z', '2026-06-18T09:12:04.000Z', 1,
 json('{"messages":[{"role":"user","content":"What cloud platforms has Steven worked with?"},{"role":"assistant","content":"Steven has hands-on experience across cloud and hybrid environments, including migrations, networking and identity. He pairs that with strong on-prem infrastructure background, so he is comfortable bridging the two."}],"cta":false}')),
('steven.clydeford.net', '203.0.113.11', '2026-06-18T11:48:31.000Z', '2026-06-18T13:02:10.000Z', 2,
 json('{"messages":[{"role":"user","content":"Does Steven have security experience?"},{"role":"assistant","content":"Yes. Steven works across security tooling and hardening, with experience in detection, response and building defensive automation."},{"role":"user","content":"Can he do incident response?"},{"role":"assistant","content":"He can. Steven has handled incident response workflows and helped build the automation that speeds them up."}],"cta":false}')),
('steven.clydeford.net', '203.0.113.12', '2026-06-18T14:20:55.000Z', '2026-06-18T14:21:40.000Z', 1,
 json('{"messages":[{"role":"user","content":"How do I get in touch with Steven about a role?"},{"role":"assistant","content":"The best way is to email Steven directly, or grab his CV from the download link on this page. Happy to pass on what you are looking for."}],"cta":true}')),
('steven.clydeford.net', '203.0.113.13', '2026-06-18T16:05:12.000Z', '2026-06-18T16:05:12.000Z', 1,
 json('{"messages":[{"role":"user","content":"Tell me about Stevens automation work."},{"role":"assistant","content":"Steven builds automation across infrastructure and operations: provisioning, configuration management and self-service tooling that cuts manual effort and reduces errors."}],"cta":false}')),
('steven.clydeford.net', '203.0.113.14', '2026-06-18T18:33:47.000Z', '2026-06-18T19:10:02.000Z', 2,
 json('{"messages":[{"role":"user","content":"What datacentre experience does Steven have?"},{"role":"assistant","content":"Steven has worked extensively in datacentre environments covering compute, storage, networking and the physical-to-virtual layers."},{"role":"user","content":"Any collaboration tooling experience?"},{"role":"assistant","content":"Yes, he has rolled out and supported collaboration platforms alongside the core infrastructure work."}],"cta":false}'));
