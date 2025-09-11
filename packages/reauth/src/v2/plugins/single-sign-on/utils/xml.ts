/**
 * Cross-Platform XML Processing Utilities for SSO Plugin V2
 * Protocol-agnostic XML operations without browser/Node.js specific dependencies
 */

/**
 * Simple XML node representation
 */
export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text?: string;
}

/**
 * Cross-platform XML processor
 * Simple XML parser and builder that works across all JavaScript runtimes
 */
export class CrossPlatformXml {
  /**
   * Parse XML string into a simple node structure
   * Simplified parser for basic SAML XML processing
   */
  static parseXml(xmlString: string): XmlNode {
    // Remove XML declaration and normalize whitespace
    const cleaned = xmlString
      .replace(/<\?xml[^>]*\?>/i, '')
      .replace(/>\s+</g, '><')
      .trim();

    return this.parseXmlNode(cleaned, 0).node;
  }

  private static parseXmlNode(xml: string, startIndex: number): { node: XmlNode; endIndex: number } {
    // Find opening tag
    const tagStart = xml.indexOf('<', startIndex);
    if (tagStart === -1) {
      throw new Error('No opening tag found');
    }

    const tagEnd = xml.indexOf('>', tagStart);
    if (tagEnd === -1) {
      throw new Error('Malformed opening tag');
    }

    const tagContent = xml.slice(tagStart + 1, tagEnd);
    const isSelfClosing = tagContent.endsWith('/');
    const actualTagContent = isSelfClosing ? tagContent.slice(0, -1) : tagContent;

    // Parse tag name and attributes
    const parts = actualTagContent.trim().split(/\s+/);
    const tagName = parts[0];
    const attributes: Record<string, string> = {};

    // Parse attributes
    for (let i = 1; i < parts.length; i++) {
      const attrMatch = parts[i].match(/^([^=]+)=["']([^"']*)["']$/);
      if (attrMatch) {
        attributes[attrMatch[1]] = attrMatch[2];
      }
    }

    const node: XmlNode = {
      name: tagName,
      attributes,
      children: [],
    };

    if (isSelfClosing) {
      return { node, endIndex: tagEnd + 1 };
    }

    // Find closing tag
    const closingTag = `</${tagName}>`;
    let currentIndex = tagEnd + 1;
    let openTags = 1;
    let contentStart = currentIndex;

    while (openTags > 0 && currentIndex < xml.length) {
      const nextOpen = xml.indexOf(`<${tagName}`, currentIndex);
      const nextClose = xml.indexOf(closingTag, currentIndex);

      if (nextClose === -1) {
        throw new Error(`No closing tag found for ${tagName}`);
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Check if it's actually the same tag (not just a substring match)
        const afterTag = xml[nextOpen + tagName.length + 1];
        if (afterTag === '>' || afterTag === ' ') {
          openTags++;
          currentIndex = nextOpen + tagName.length + 1;
          continue;
        }
      }

      if (openTags === 1) {
        // This is our closing tag
        const content = xml.slice(contentStart, nextClose).trim();
        
        if (content && !content.includes('<')) {
          // Text content
          node.text = this.decodeXmlEntities(content);
        } else if (content) {
          // Parse child elements
          let childIndex = contentStart;
          while (childIndex < nextClose) {
            const nextChildStart = xml.indexOf('<', childIndex);
            if (nextChildStart === -1 || nextChildStart >= nextClose) break;

            const childResult = this.parseXmlNode(xml, nextChildStart);
            node.children.push(childResult.node);
            childIndex = childResult.endIndex;
          }
        }

        return { node, endIndex: nextClose + closingTag.length };
      }

      openTags--;
      currentIndex = nextClose + closingTag.length;
    }

    throw new Error(`Malformed XML: unclosed tag ${tagName}`);
  }

  /**
   * Build XML string from node structure
   */
  static buildXml(node: XmlNode, indent: number = 0): string {
    const indentStr = '  '.repeat(indent);
    let xml = `${indentStr}<${node.name}`;

    // Add attributes
    for (const [key, value] of Object.entries(node.attributes)) {
      xml += ` ${key}="${this.encodeXmlEntities(value)}"`;
    }

    if (!node.text && node.children.length === 0) {
      return `${xml} />`;
    }

    xml += '>';

    if (node.text) {
      xml += this.encodeXmlEntities(node.text);
    }

    if (node.children.length > 0) {
      xml += '\n';
      for (const child of node.children) {
        xml += this.buildXml(child, indent + 1) + '\n';
      }
      xml += indentStr;
    }

    xml += `</${node.name}>`;
    return xml;
  }

  /**
   * Find node by name (recursive)
   */
  static findNode(node: XmlNode, name: string): XmlNode | null {
    if (node.name === name) {
      return node;
    }

    for (const child of node.children) {
      const found = this.findNode(child, name);
      if (found) return found;
    }

    return null;
  }

  /**
   * Find all nodes by name (recursive)
   */
  static findAllNodes(node: XmlNode, name: string): XmlNode[] {
    const results: XmlNode[] = [];

    if (node.name === name) {
      results.push(node);
    }

    for (const child of node.children) {
      results.push(...this.findAllNodes(child, name));
    }

    return results;
  }

  /**
   * Get attribute value
   */
  static getAttribute(node: XmlNode, name: string): string | null {
    return node.attributes[name] || null;
  }

  /**
   * Get text content of node
   */
  static getTextContent(node: XmlNode): string {
    if (node.text) return node.text;

    let text = '';
    for (const child of node.children) {
      text += this.getTextContent(child);
    }
    return text;
  }

  /**
   * Encode XML entities
   */
  private static encodeXmlEntities(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Decode XML entities
   */
  private static decodeXmlEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  /**
   * Create SAML AuthnRequest XML
   */
  static createSamlAuthnRequest(options: {
    requestId: string;
    issueInstant: string;
    issuer: string;
    assertionConsumerServiceURL: string;
    destination: string;
    nameIdFormat?: string;
    forceAuthn?: boolean;
    isPassive?: boolean;
  }): string {
    const root: XmlNode = {
      name: 'samlp:AuthnRequest',
      attributes: {
        'xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
        'xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
        'ID': options.requestId,
        'Version': '2.0',
        'IssueInstant': options.issueInstant,
        'Destination': options.destination,
        'AssertionConsumerServiceURL': options.assertionConsumerServiceURL,
        'ProtocolBinding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      },
      children: [
        {
          name: 'saml:Issuer',
          attributes: {},
          children: [],
          text: options.issuer,
        },
      ],
    };

    if (options.forceAuthn !== undefined) {
      root.attributes['ForceAuthn'] = options.forceAuthn.toString();
    }

    if (options.isPassive !== undefined) {
      root.attributes['IsPassive'] = options.isPassive.toString();
    }

    if (options.nameIdFormat) {
      root.children.push({
        name: 'samlp:NameIDPolicy',
        attributes: {
          'Format': options.nameIdFormat,
          'AllowCreate': 'true',
        },
        children: [],
      });
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + this.buildXml(root);
  }

  /**
   * Create SAML LogoutRequest XML
   */
  static createSamlLogoutRequest(options: {
    requestId: string;
    issueInstant: string;
    issuer: string;
    destination: string;
    nameId: string;
    nameIdFormat: string;
    sessionIndex?: string;
  }): string {
    const nameIdNode: XmlNode = {
      name: 'saml:NameID',
      attributes: {
        'Format': options.nameIdFormat,
      },
      children: [],
      text: options.nameId,
    };

    const children: XmlNode[] = [
      {
        name: 'saml:Issuer',
        attributes: {},
        children: [],
        text: options.issuer,
      },
      nameIdNode,
    ];

    if (options.sessionIndex) {
      children.push({
        name: 'samlp:SessionIndex',
        attributes: {},
        children: [],
        text: options.sessionIndex,
      });
    }

    const root: XmlNode = {
      name: 'samlp:LogoutRequest',
      attributes: {
        'xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
        'xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
        'ID': options.requestId,
        'Version': '2.0',
        'IssueInstant': options.issueInstant,
        'Destination': options.destination,
      },
      children,
    };

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + this.buildXml(root);
  }

  /**
   * Extract SAML Response data
   */
  static parseSamlResponse(xml: string): {
    issuer?: string;
    statusCode?: string;
    assertion?: XmlNode;
    nameId?: string;
    sessionIndex?: string;
    attributes: Record<string, string[]>;
  } {
    const root = this.parseXml(xml);
    const result: any = { attributes: {} };

    // Find issuer
    const issuerNode = this.findNode(root, 'saml:Issuer');
    if (issuerNode) {
      result.issuer = this.getTextContent(issuerNode);
    }

    // Find status code
    const statusCodeNode = this.findNode(root, 'samlp:StatusCode');
    if (statusCodeNode) {
      result.statusCode = this.getAttribute(statusCodeNode, 'Value');
    }

    // Find assertion
    const assertionNode = this.findNode(root, 'saml:Assertion');
    if (assertionNode) {
      result.assertion = assertionNode;

      // Extract NameID
      const nameIdNode = this.findNode(assertionNode, 'saml:NameID');
      if (nameIdNode) {
        result.nameId = this.getTextContent(nameIdNode);
      }

      // Extract SessionIndex
      const authStatementNode = this.findNode(assertionNode, 'saml:AuthnStatement');
      if (authStatementNode) {
        result.sessionIndex = this.getAttribute(authStatementNode, 'SessionIndex');
      }

      // Extract attributes
      const attributeNodes = this.findAllNodes(assertionNode, 'saml:Attribute');
      for (const attrNode of attributeNodes) {
        const name = this.getAttribute(attrNode, 'Name');
        if (name) {
          const valueNodes = this.findAllNodes(attrNode, 'saml:AttributeValue');
          result.attributes[name] = valueNodes.map(node => this.getTextContent(node));
        }
      }
    }

    return result;
  }

  /**
   * Canonicalize XML for signature verification (simplified)
   */
  static canonicalizeXml(xml: string): string {
    // Simplified canonicalization - remove extra whitespace and normalize
    return xml
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .trim();
  }
}