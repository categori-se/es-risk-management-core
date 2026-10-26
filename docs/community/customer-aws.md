# Customer-controlled AWS reference

`deploy/community/customer-aws.cfn.json` is an inspectable CloudFormation reference for a **dedicated single-operator** installation. It has not been deployed to a customer account. Static template validation and local container acceptance are separate from customer deployment acceptance. The template creates billable EC2, EBS and Systems Manager usage; a free-tier allowance is not a spending cap.

The customer supplies its own VPC/subnet, matching availability zone, approved immutable x86_64 Linux AMI and approved digest-pinned application image. The AMI must already contain Podman, an active SSM Agent, systemd, curl and xfsprogs. Avoid bootstrap package refreshes: record the AMI, OS packages, approved source commit, source manifest, image digest and assurance receipt as one release. Use the selected account's credentials and region explicitly; never rely on a default profile.

The EC2 instance receives no public IP or inbound security-group rule. The app listens on loopback and is reached through a customer-authorized Systems Manager port-forwarding session. The subnet needs HTTPS routes to SSM and the approved registry, through customer-operated endpoints or existing egress infrastructure; the template creates neither a NAT gateway nor VPC endpoints. The application image has no provider credentials. No schedule, queue, Lambda consumer, remote AI route or autoscaling worker is created.

The attached gp3 data volume is encrypted and retained on stack deletion/replacement. The app image is read-only and runs as UID 1000 with dropped capabilities; client bytes live on the data volume. The host administrator and SSM-authorized operator can access that data. Local account labels do not establish multi-user security, and this reference does not implement institutional SSO, shared tenancy, HA or managed backups. Other users on the same host can reach TCP loopback; separate operating-system identities alone do not isolate the application API. For mutually untrusted practitioners use the authenticated service with independently accepted deployment controls or separate devices/VMs with enforced storage and network boundaries.

Inspect and lint locally before preparing a customer change set:

```sh
cfn-lint deploy/community/customer-aws.cfn.json
```

After the customer approves its specific resources, AMI/image, permissions, costs and retention, create a change set from the reviewed file in the customer account. This repository does not launch one automatically. Record the exact template hash and parameter values, excluding secrets. The instance IAM profile uses the AWS-managed Systems Manager instance policy; grant human operators only the approved instance and the port-forwarding session document, with session start/stop activity recorded by the customer's control plane. A Systems Manager port-forwarded application's traffic content is not a substitute for the app audit record.

The operator's access command follows this form, substituting its own profile and region:

```sh
aws ssm start-session --profile CUSTOMER_PROFILE --region CUSTOMER_REGION \
  --target INSTANCE_ID --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["4173"],"localPortNumber":["4173"]}'
```

Open `http://127.0.0.1:4173`. Use the same local/remote port because the app validates the exact Host/Origin. Provisioning has a bounded five-minute data-volume attachment wait and exits on failure. A service failure is not retried indefinitely; inspect the recorded error and restart deliberately. No worker remains waiting for a message.

Customer acceptance must inspect the effective security group and IAM permissions, confirm the loopback listener, run the synthetic assessment/isolation/export/restore journey through the tunnel, verify disk encryption, inspect source and audit records, and test a stopped backup restore. Stop the service before a consistent full-volume snapshot; configure retention and access under the customer's policy. Retained volumes continue to incur charges after stack deletion. A replacement stack does not automatically reattach old data: restore a reviewed backup or explicitly attach the retained volume after verifying custody and schema compatibility.

Cost planning should include EC2 running hours, gp3 capacity and snapshots, image storage/transfer, SSM options, existing egress and optional explicitly approved AI usage. Stop an unused instance and retain only needed encrypted data; do not introduce background polling to keep it warm. Actual prices and customer approval belong in the deployment-specific cost sheet, not an assumed zero-cost claim.

See AWS's [Session Manager session and port-forwarding instructions](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html), [IAM session-document scoping](https://docs.aws.amazon.com/systems-manager/latest/userguide/getting-started-specify-session-document.html), and [EBS encryption documentation](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html).
